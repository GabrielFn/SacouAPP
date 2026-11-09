using System.Text.Json;
using Sacou.Modules.Identity.Authentication;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Authentication;

/// <summary>A3: the time edges on the pure function, with a fixed clock. Plus each payload rule on its own.</summary>
public sealed class FirebaseTokenRulesTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 11, 8, 12, 0, 0, TimeSpan.Zero);
    private static readonly FirebaseProjectOptions Project = new() { ProjectId = TestIdToken.ProjectId };

    private readonly TestSigningKey key = TestSigningKey.Create("rules");

    [Theory]
    [InlineData("exp", 1, "")]
    [InlineData("exp", -60, "")]
    [InlineData("exp", -61, "Expired")]
    [InlineData("iat", 60, "")]
    [InlineData("iat", 61, "IssuedInTheFuture")]
    [InlineData("auth_time", 60, "")]
    [InlineData("auth_time", 61, "AuthenticatedInTheFuture")]
    [InlineData("nbf", 60, "")]
    [InlineData("nbf", 61, "NotYetValid")]
    public void TimeEdges_FollowTheSixtySecondSkew(string claim, int secondsFromNow, string expected)
    {
        IdTokenRejection? rejection = expected.Length == 0 ? null : Enum.Parse<IdTokenRejection>(expected);
        var payload = Payload(Valid().At(Now.AddSeconds(secondsFromNow), claim));

        Assert.Equal(rejection, FirebaseTokenRules.CheckTimes(payload, Now));
    }

    [Theory]
    [InlineData("exp")]
    [InlineData("iat")]
    [InlineData("auth_time")]
    public void RequiredTimeMissingOrNotANumber_IsRefused(string claim)
    {
        Assert.Equal(IdTokenRejection.MissingTime, FirebaseTokenRules.CheckTimes(Payload(Valid().Without(claim)), Now));
        Assert.Equal(IdTokenRejection.MissingTime, FirebaseTokenRules.CheckTimes(Payload(Valid().With(claim, "1700000000")), Now));
        Assert.Equal(IdTokenRejection.MissingTime, FirebaseTokenRules.CheckTimes(Payload(Valid().WithRaw(claim, "1.5")), Now));
    }

    [Fact]
    public void ValidPayload_GivesTheSubjectAndTheProvider()
    {
        var login = FirebaseTokenRules.Check(Payload(Valid()), Project, Now);

        Assert.True(login.IsSuccess);
        Assert.Equal(TestIdToken.Subject, login.Value.Subject.Value);
        Assert.Equal(SignInProvider.Password, login.Value.Provider);
    }

    [Theory]
    [InlineData("password", "Password")]
    [InlineData("google.com", "Google")]
    [InlineData("apple.com", "Apple")]
    public void AllowedProviders_AreRead(string name, string expected)
    {
        var login = FirebaseTokenRules.Check(Payload(Valid().WithRaw("firebase", TestIdToken.Firebase(name))), Project, Now);

        Assert.Equal(Enum.Parse<SignInProvider>(expected), login.Value.Provider);
    }

    public static TheoryData<string, string, string> PayloadRefusals => new()
    {
        { "aud", "\"other-project\"", nameof(IdTokenRejection.WrongAudience) },
        { "aud", $"[\"{TestIdToken.ProjectId}\"]", nameof(IdTokenRejection.WrongAudience) },
        { "aud", $"\"{TestIdToken.ProjectId}/\"", nameof(IdTokenRejection.WrongAudience) },
        { "iss", $"\"{TestIdToken.Issuer}/\"", nameof(IdTokenRejection.WrongIssuer) },
        { "iss", "\"https://accounts.google.com\"", nameof(IdTokenRejection.WrongIssuer) },
        { "sub", "12345", nameof(IdTokenRejection.InvalidSubject) },
        { "firebase", TestIdToken.Firebase("anonymous"), nameof(IdTokenRejection.DisallowedProvider) },
        { "firebase", TestIdToken.Firebase("Password"), nameof(IdTokenRejection.DisallowedProvider) },
        { "firebase", "\"password\"", nameof(IdTokenRejection.DisallowedProvider) },
        { "firebase", """{"sign_in_provider":"google.com","tenant":"t1"}""", nameof(IdTokenRejection.TenantPresent) },
    };

    [Theory]
    [MemberData(nameof(PayloadRefusals))]
    public void PayloadRule_RefusesWithItsCategory(string claim, string json, string expected)
    {
        Assert.True(FirebaseTokenRules.Check(Payload(Valid()), Project, Now).IsSuccess);

        var login = FirebaseTokenRules.Check(Payload(Valid().WithRaw(claim, json)), Project, Now);

        Assert.Equal(Enum.Parse<IdTokenRejection>(expected), login.Error.ToRejection());
    }

    public void Dispose() => key.Dispose();

    private TestIdToken Valid() => TestIdToken.Valid(key, Now);

    private static JsonElement Payload(TestIdToken token) => JsonDocument.Parse(token.PayloadJson).RootElement.Clone();
}
