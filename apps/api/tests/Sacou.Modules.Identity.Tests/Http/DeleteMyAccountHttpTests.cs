using System.Net;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Http;

/// <summary>
/// <c>DELETE /v1/me</c> through the real authentication (E3.16, ADR 0056): the <c>auth_time</c> claim reaches the
/// handler, the tombstone turns the next sign-in into a 410, a body is refused, nothing is cached.
/// </summary>
public sealed class DeleteMyAccountHttpTests
{
    private const string MePath = "/v1/me";

    [Fact]
    public async Task RecentLogin_Deletes_ThenTheSameLoginIsGone()
    {
        await using var host = await IdentityTestHost.StartAsync(TestSigningKeys.Shared);
        var token = Token(TimeSpan.FromMinutes(1));
        using var created = await host.SignInAsync(token);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        using var deleted = await host.SendAsync(HttpMethods.Delete, MePath, token);
        using var again = await host.SendAsync(HttpMethods.Delete, MePath, token);
        using var signIn = await host.SignInAsync(token);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal("no-store", deleted.Headers.CacheControl?.ToString());
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Equal(HttpStatusCode.Gone, signIn.StatusCode);
        Assert.Equal("identity.account-deleted", await CodeAsync(signIn));
        Assert.Empty(host.Users.Subjects);
        Assert.Equal([TestIdToken.Subject], host.Users.DeletedSubjects);
    }

    /// <summary>D2 of the plan: the default test token signed in ten minutes ago, so it must sign in again first.</summary>
    [Fact]
    public async Task OldLogin_IsA403_ThatKeepsTheAccount()
    {
        await using var host = await IdentityTestHost.StartAsync(TestSigningKeys.Shared);
        var token = Token(TimeSpan.FromMinutes(10));
        using var created = await host.SignInAsync(token);

        using var response = await host.SendAsync(HttpMethods.Delete, MePath, token);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("identity.recent-login-required", await CodeAsync(response));
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Equal([TestIdToken.Subject], host.Users.Subjects);
    }

    /// <summary>D10 of the plan: a body on the delete is refused, never ignored.</summary>
    [Fact]
    public async Task Body_IsA400_ThatKeepsTheAccount()
    {
        await using var host = await IdentityTestHost.StartAsync(TestSigningKeys.Shared);
        var token = Token(TimeSpan.Zero);
        using var created = await host.SignInAsync(token);

        using var response = await host.SendAsync(HttpMethods.Delete, MePath, token, """{"confirm":"EXCLUIR"}""");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("identity.body-not-allowed", await CodeAsync(response));
        Assert.Equal([TestIdToken.Subject], host.Users.Subjects);
    }

    [Fact]
    public async Task Logs_CarryNeitherTheUidNorTheToken()
    {
        await using var host = await IdentityTestHost.StartAsync(TestSigningKeys.Shared);
        var token = Token(TimeSpan.Zero);
        using var created = await host.SignInAsync(token);

        using var deleted = await host.SendAsync(HttpMethods.Delete, MePath, token);
        using var gone = await host.SignInAsync(token);

        var entries = host.Logs.EntriesSince(0);
        Assert.Contains(entries, entry => entry.Contains("Account deleted.", StringComparison.Ordinal));
        Assert.DoesNotContain(entries, entry => TestIdTokens.Fragments(token).Append(TestIdToken.Subject)
            .Any(secret => entry.Contains(secret, StringComparison.Ordinal)));
    }

    private static string Token(TimeSpan signedInAgo)
    {
        var now = FixedTimeProvider.WholeSecondNow();
        return TestIdToken.Valid(TestSigningKeys.Shared, now).At(now - signedInAgo, "auth_time").Sign();
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))?["code"]?.GetValue<string>();
}
