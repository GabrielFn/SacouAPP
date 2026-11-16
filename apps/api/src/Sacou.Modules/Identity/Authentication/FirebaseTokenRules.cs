using System.Collections.Frozen;
using System.Text.Json;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// The Firebase rules on the payload of a token whose signature already passed, one function per rule
/// (ADR 0036, D2). Pure: the clock comes in. The library checks the times too, as a second barrier.
/// </summary>
internal static class FirebaseTokenRules
{
    /// <summary>Clock drift tolerated between Google and the server, in both directions.</summary>
    public static readonly TimeSpan ClockSkew = TimeSpan.FromSeconds(60);

    private const string Audience = "aud";
    private const string Issuer = "iss";
    private const string Subject = "sub";
    private const string ExpiresAt = "exp";
    private const string IssuedAt = "iat";
    private const string AuthenticatedAt = "auth_time";
    private const string NotBefore = "nbf";
    private const string Firebase = "firebase";
    private const string Provider = "sign_in_provider";
    private const string Tenant = "tenant";

    /// <summary>The range <see cref="DateTimeOffset.FromUnixTimeSeconds"/> accepts (years 1970 to 9999).</summary>
    private const long MinUnixSeconds = 0;
    private const long MaxUnixSeconds = 253_402_300_799;

    private static readonly FrozenDictionary<string, SignInProvider> AllowedProviders =
        new Dictionary<string, SignInProvider>(StringComparer.Ordinal)
        {
            ["password"] = SignInProvider.Password,
            ["google.com"] = SignInProvider.Google,
            ["apple.com"] = SignInProvider.Apple,
        }.ToFrozenDictionary(StringComparer.Ordinal);

    private static readonly Func<RuleInput, IdTokenRejection?>[] Rules =
    [
        input => IsExactString(input.Payload, Audience, input.ProjectId) ? null : IdTokenRejection.WrongAudience,
        input => IsExactString(input.Payload, Issuer, input.Issuer) ? null : IdTokenRejection.WrongIssuer,
        input => CheckTimes(input.Payload, input.Now),
        input => HasTenant(input.Payload) ? IdTokenRejection.TenantPresent : null,
    ];

    private static readonly Func<JsonElement, DateTimeOffset, IdTokenRejection?>[] TimeRules =
    [
        (payload, now) => Required(payload, ExpiresAt, time => time < now - ClockSkew, IdTokenRejection.Expired),
        (payload, now) => Required(payload, IssuedAt, time => time > now + ClockSkew, IdTokenRejection.IssuedInTheFuture),
        (payload, now) => Required(payload, AuthenticatedAt, time => time > now + ClockSkew, IdTokenRejection.AuthenticatedInTheFuture),
        (payload, now) => Optional(payload, NotBefore, time => time > now + ClockSkew, IdTokenRejection.NotYetValid),
    ];

    public static Result<VerifiedLogin> Check(JsonElement payload, FirebaseProjectOptions project, DateTimeOffset now)
    {
        var input = new RuleInput(payload, project.ProjectId, project.Issuer, now);
        var rejection = Rules.Select(rule => rule(input)).FirstOrDefault(result => result is not null);
        return rejection is { } refused ? Result.Failure<VerifiedLogin>(refused.ToError()) : ToLogin(payload);
    }

    /// <summary><c>exp</c>, <c>iat</c> and <c>auth_time</c> are required; <c>nbf</c> is checked when present.</summary>
    public static IdTokenRejection? CheckTimes(JsonElement payload, DateTimeOffset now) =>
        TimeRules.Select(rule => rule(payload, now)).FirstOrDefault(result => result is not null);

    private static Result<VerifiedLogin> ToLogin(JsonElement payload)
    {
        var subject = AuthSubject.Create(ReadString(payload, Subject));
        if (subject.IsFailure)
        {
            return Result.Failure<VerifiedLogin>(IdTokenRejection.InvalidSubject.ToError());
        }

        if (ReadProvider(payload) is not { } provider)
        {
            return Result.Failure<VerifiedLogin>(IdTokenRejection.DisallowedProvider.ToError());
        }

        // CheckTimes already refused a token without a readable auth_time.
        var authenticatedAt = ReadTime(payload, AuthenticatedAt) ?? throw new InvalidOperationException("auth_time was checked first.");
        return Result.Success(new VerifiedLogin(subject.Value, provider, authenticatedAt));
    }

    private static SignInProvider? ReadProvider(JsonElement payload) =>
        payload.TryGetProperty(Firebase, out var firebase)
        && ReadString(firebase, Provider) is { } name
        && AllowedProviders.TryGetValue(name, out var provider)
            ? provider
            : null;

    private static bool HasTenant(JsonElement payload) =>
        payload.TryGetProperty(Firebase, out var firebase)
        && firebase.ValueKind == JsonValueKind.Object
        && firebase.TryGetProperty(Tenant, out _);

    /// <summary>A string, never a list: <c>["project", "other"]</c> is refused even if one value matches.</summary>
    private static bool IsExactString(JsonElement payload, string claim, string expected) =>
        string.Equals(ReadString(payload, claim), expected, StringComparison.Ordinal);

    private static string? ReadString(JsonElement element, string property) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(property, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static IdTokenRejection? Required(
        JsonElement payload, string claim, Func<DateTimeOffset, bool> isRefused, IdTokenRejection rejection) =>
        ReadTime(payload, claim) switch
        {
            null => IdTokenRejection.MissingTime,
            var time when isRefused(time.Value) => rejection,
            _ => null,
        };

    private static IdTokenRejection? Optional(
        JsonElement payload, string claim, Func<DateTimeOffset, bool> isRefused, IdTokenRejection rejection) =>
        payload.TryGetProperty(claim, out _) ? Required(payload, claim, isRefused, rejection) : null;

    private static DateTimeOffset? ReadTime(JsonElement payload, string claim) =>
        payload.TryGetProperty(claim, out var value)
        && value.ValueKind == JsonValueKind.Number
        && value.TryGetInt64(out var seconds)
        && seconds is >= MinUnixSeconds and <= MaxUnixSeconds
            ? DateTimeOffset.FromUnixTimeSeconds(seconds)
            : null;

    private sealed record RuleInput(JsonElement Payload, string ProjectId, string Issuer, DateTimeOffset Now);
}
