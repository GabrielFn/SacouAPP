using System.Collections.Immutable;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace Sacou.Tests.TestSupport;

/// <summary>
/// A Firebase-shaped ID token, valid by default, changed one field at a time with <c>With</c> and
/// <c>Without</c>. Header and claims are kept as raw JSON values, so a test can put any type in any
/// field (a number in <c>sub</c>, a list in <c>aud</c>). The refusal matrix comes from one table.
/// </summary>
internal sealed record TestIdToken
{
    public const string ProjectId = "sacou-test-project";
    public const string Issuer = "https://securetoken.google.com/" + ProjectId;
    public const string Subject = "Uid0123456789abcdefXYZ";
    public const string Email = "pessoa.teste@example.com";
    public const string Name = "Pessoa Teste";
    public const string Picture = "https://example.com/foto-teste.png";

    private static readonly TimeSpan AuthenticatedAgo = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan IssuedAgo = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan ValidFor = TimeSpan.FromMinutes(59);

    public required TestSigningKey Key { get; init; }

    public required ImmutableDictionary<string, string> Header { get; init; }

    public required ImmutableDictionary<string, string> Claims { get; init; }

    /// <summary>Signs the <c>header.payload</c> bytes. RS256 with <see cref="Key"/> unless replaced.</summary>
    public Func<byte[], byte[]>? Signer { get; init; }

    public static TestIdToken Valid(TestSigningKey key, DateTimeOffset now, string provider = "password") => new()
    {
        Key = key,
        Header = ImmutableDictionary<string, string>.Empty
            .Add("alg", Json("RS256"))
            .Add("kid", Json(key.KeyId))
            .Add("typ", Json("JWT")),
        Claims = ImmutableDictionary<string, string>.Empty
            .Add("iss", Json(Issuer))
            .Add("aud", Json(ProjectId))
            .Add("auth_time", Json((now - AuthenticatedAgo).ToUnixTimeSeconds()))
            .Add("user_id", Json(Subject))
            .Add("sub", Json(Subject))
            .Add("iat", Json((now - IssuedAgo).ToUnixTimeSeconds()))
            .Add("exp", Json((now + ValidFor).ToUnixTimeSeconds()))
            .Add("email", Json(Email))
            .Add("email_verified", Json(false))
            .Add("name", Json(Name))
            .Add("picture", Json(Picture))
            .Add("firebase", Firebase(provider)),
    };

    public static string Firebase(string provider) =>
        $$"""{"identities":{"email":[{{Json(Email)}}]},"sign_in_provider":{{Json(provider)}}}""";

    public static string Json<T>(T value) => JsonSerializer.Serialize(value);

    public static string Base64Url(string text) => Base64UrlEncoder.Encode(Encoding.UTF8.GetBytes(text));

    public TestIdToken With(string claim, object? value) => this with { Claims = Claims.SetItem(claim, Json(value)) };

    public TestIdToken WithRaw(string claim, string json) => this with { Claims = Claims.SetItem(claim, json) };

    public TestIdToken Without(string claim) => this with { Claims = Claims.Remove(claim) };

    public TestIdToken WithHeader(string field, object? value) => this with { Header = Header.SetItem(field, Json(value)) };

    public TestIdToken WithoutHeader(string field) => this with { Header = Header.Remove(field) };

    public TestIdToken At(DateTimeOffset time, string claim) => With(claim, time.ToUnixTimeSeconds());

    public string HeaderJson => ToJsonObject(Header);

    public string PayloadJson => ToJsonObject(Claims);

    public string Sign()
    {
        var signingInput = $"{Base64Url(HeaderJson)}.{Base64Url(PayloadJson)}";
        var signature = (Signer ?? Key.SignRs256)(Encoding.ASCII.GetBytes(signingInput));
        return $"{signingInput}.{Base64UrlEncoder.Encode(signature)}";
    }

    private static string ToJsonObject(ImmutableDictionary<string, string> fields) =>
        "{" + string.Join(',', fields.OrderBy(field => field.Key, StringComparer.Ordinal)
            .Select(field => $"{Json(field.Key)}:{field.Value}")) + "}";
}

internal static class TestIdTokens
{
    private const char PartSeparator = '.';

    /// <summary>Keeps header and signature, swaps the payload: a token changed after signing.</summary>
    public static string ReplacePayload(string token, string payloadJson)
    {
        var parts = token.Split(PartSeparator);
        return $"{parts[0]}.{TestIdToken.Base64Url(payloadJson)}.{parts[2]}";
    }

    public static string ReplaceSignature(string token, string signature)
    {
        var parts = token.Split(PartSeparator);
        return $"{parts[0]}.{parts[1]}.{signature}";
    }

    /// <summary>Every piece of a token a log must never show: the whole token and each segment.</summary>
    public static IReadOnlyList<string> Fragments(string token) => [token, .. token.Split(PartSeparator).Where(part => part.Length > 0)];
}
