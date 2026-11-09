using System.Net;
using System.Net.Http.Json;
using Microsoft.IdentityModel.Logging;
using Sacou.Modules.Identity.Authentication;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Http;

public sealed class SignInAcceptanceTests
{
    private const string UserIdField = "userId";

    [Fact]
    public async Task PasswordWithUnverifiedEmail_CreatesThenFindsTheSameUser()
    {
        var key = TestSigningKeys.Shared;
        await using var host = await IdentityTestHost.StartAsync(key);
        var token = TestIdToken.Valid(key, FixedTimeProvider.WholeSecondNow()).With("email_verified", false).Sign();

        using var first = await host.SignInAsync(token);
        using var second = await host.SignInAsync(token);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(await UserIdAsync(first), await UserIdAsync(second));
        Assert.Equal([TestIdToken.Subject], host.Users.Subjects);
    }

    [Theory]
    [InlineData("google.com")]
    [InlineData("apple.com")]
    public async Task GoogleAndApple_AreAccepted(string provider)
    {
        var key = TestSigningKeys.Shared;
        await using var host = await IdentityTestHost.StartAsync(key);

        using var response = await host.SignInAsync(TestIdToken.Valid(key, FixedTimeProvider.WholeSecondNow(), provider).Sign());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Theory]
    [InlineData("exp", 30)]
    [InlineData("exp", 120)]
    [InlineData("iat", -30)]
    [InlineData("iat", -120)]
    [InlineData("auth_time", -30)]
    [InlineData("auth_time", -120)]
    [InlineData("iat", 30)]
    [InlineData("auth_time", 30)]
    public async Task TimesWithinTheMargins_AreAccepted(string claim, int secondsFromNow)
    {
        var key = TestSigningKeys.Shared;
        await using var host = await IdentityTestHost.StartAsync(key);
        var now = FixedTimeProvider.WholeSecondNow();

        using var response = await host.SignInAsync(
            TestIdToken.Valid(key, now).At(now.AddSeconds(secondsFromNow), claim).Sign());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task SubjectOf128VisibleCharacters_IsAccepted()
    {
        var key = TestSigningKeys.Shared;
        await using var host = await IdentityTestHost.StartAsync(key);
        var subject = string.Concat(Enumerable.Range('!', '~' - '!' + 1).Select(code => (char)code)).PadRight(128, 'z');

        using var response = await host.SignInAsync(TestIdToken.Valid(key, FixedTimeProvider.WholeSecondNow()).With("sub", subject).Sign());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal([subject], host.Users.Subjects);
    }

    [Fact]
    public async Task EmailNameAndPicture_NeverReachTheStoreTheResponseOrTheLogs()
    {
        var key = TestSigningKeys.Shared;
        await using var host = await IdentityTestHost.StartAsync(key);
        var token = TestIdToken.Valid(key, FixedTimeProvider.WholeSecondNow()).Sign();

        using var response = await host.SignInAsync(token);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal([UserIdField], System.Text.Json.Nodes.JsonNode.Parse(body)!.AsObject().Select(field => field.Key));
        Assert.DoesNotContain(TestIdToken.Email, body, StringComparison.Ordinal);
        Assert.Equal([TestIdToken.Subject], host.Users.Subjects);
        LogAssert.HasNoSecrets(host.Logs, [token]);
    }

    [Fact]
    public async Task SigningKeysUnreachable_AnswerServiceUnavailableWithRetryAfter()
    {
        var key = TestSigningKeys.Shared;
        await using var host = await IdentityTestHost.StartAsync(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError));

        using var response = await host.SignInAsync(TestIdToken.Valid(key, FixedTimeProvider.WholeSecondNow()).Sign());

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(FirebaseAuthenticationHandler.RetryAfter, response.Headers.RetryAfter?.Delta);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(0, host.Users.Calls);
    }

    [Fact]
    public async Task AfterComposition_IdentityModelNeverLogsPersonalData()
    {
        var key = TestSigningKeys.Shared;
        await using var host = await IdentityTestHost.StartAsync(key);

        Assert.False(IdentityModelEventSource.ShowPII);
        Assert.False(IdentityModelEventSource.LogCompleteSecurityArtifact);
    }

    private static async Task<string> UserIdAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>(TestContext.Current.CancellationToken);
        return Assert.Contains(UserIdField, body!);
    }
}
