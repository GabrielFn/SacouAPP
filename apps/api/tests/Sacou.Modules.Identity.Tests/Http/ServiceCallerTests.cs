using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Identity.Authentication;
using Sacou.Modules.Identity.Contracts;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Http;

/// <summary>
/// E9 of E3.11: the internal routes take only the Google OIDC token of the calling account (ADR 0069, D11). No token,
/// a Firebase login, a wrong audience, a wrong or unverified account, an expired token, or no settings: the same 401.
/// </summary>
public sealed class ServiceCallerTests : IAsyncDisposable
{
    private const string Audience = "https://sacou-api-test-abc.a.run.app";
    private const string Email = "sacou-tasks-invoker@sacou-test.iam.gserviceaccount.com";
    private const string Route = "/internal/test";

    private readonly TestSigningKey google = TestSigningKey.Create("google-oidc");
    private readonly DateTimeOffset now = FixedTimeProvider.WholeSecondNow();
    private readonly CollectingLoggerProvider logs = new();
    private WebApplication? app;

    [Fact]
    public async Task TheCallingAccount_Passes()
    {
        await StartAsync(configured: true);

        Assert.Equal(HttpStatusCode.NoContent, await CallAsync(Valid().Sign()));
    }

    [Fact]
    public async Task EveryOtherCaller_GetsTheSame401()
    {
        await StartAsync(configured: true);
        string[] refused =
        [
            "",
            "not-a-token",
            TestIdToken.Valid(TestSigningKeys.Shared, now).Sign(),
            Valid().With("aud", "https://other.a.run.app").Sign(),
            Valid().With("email", "someone@sacou-test.iam.gserviceaccount.com").Sign(),
            Valid().With("email_verified", false).Sign(),
            Valid().Without("email_verified").Sign(),
            Valid().With("iss", "https://securetoken.google.com/sacou-test-project").Sign(),
            Valid().At(now.AddMinutes(-10), "exp").Sign(),
            Valid().At(now.AddMinutes(10), "iat").Sign(),
        ];

        foreach (var token in refused)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, await CallAsync(token));
        }

        var all = string.Join('\n', logs.Entries);
        Assert.All(refused.Where(token => token.Length > 0).SelectMany(TestIdTokens.Fragments), fragment => Assert.DoesNotContain(fragment, all, StringComparison.Ordinal));
    }

    [Fact]
    public async Task WithoutTheSettings_EvenAValidTokenIsRefused()
    {
        await StartAsync(configured: false);

        Assert.Equal(HttpStatusCode.Unauthorized, await CallAsync(Valid().Sign()));
    }

    [Fact]
    public void ThePolicy_ReadsOnlyItsOwnScheme()
    {
        var services = new ServiceCollection().AddLogging();
        services.AddIdentityModule(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Firebase:ProjectId"] = TestIdToken.ProjectId }).Build());
        using var provider = services.BuildServiceProvider();

        var policy = provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<AuthorizationOptions>>().Value.GetPolicy(ServiceCallers.Policy);

        Assert.Equal([ServiceCallers.AuthenticationScheme], policy!.AuthenticationSchemes);
    }

    public async ValueTask DisposeAsync()
    {
        if (app is not null)
        {
            await app.DisposeAsync();
        }

        google.Dispose();
        logs.Dispose();
    }

    private TestIdToken Valid() => TestIdToken.Valid(google, now)
        .With("iss", "https://accounts.google.com")
        .With("aud", Audience)
        .With("email", Email)
        .With("email_verified", true)
        .Without("firebase")
        .Without("auth_time");

    private async Task StartAsync(bool configured)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = Environments.Production });
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Firebase:ProjectId"] = TestIdToken.ProjectId,
            ["ConnectionStrings:Sacou"] = "Host=127.0.0.1;Port=1;Database=none",
            ["ServiceCaller:Audience"] = configured ? Audience : null,
            ["ServiceCaller:Email"] = configured ? Email : null,
        });
        builder.Logging.ClearProviders().AddProvider(logs).SetMinimumLevel(LogLevel.Trace);
        builder.Services.AddAuthorizationBuilder().SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
        builder.Services.AddIdentityModule(builder.Configuration);
        builder.Services.AddHttpClient(IdentityModule.SigningKeysHttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => new StubHttpHandler(_ => StubHttpHandler.Json(TestSigningKeys.Document(TestSigningKeys.Shared), TimeSpan.FromHours(1))));
        builder.Services.AddHttpClient(ServiceCallerSigningKeys.HttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => new StubHttpHandler(_ => StubHttpHandler.Json(TestSigningKeys.Document(google), TimeSpan.FromHours(1))));
        app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapPost(Route, () => Results.NoContent()).RequireAuthorization(ServiceCallers.Policy);
        await app.StartAsync(TestContext.Current.CancellationToken);
    }

    private async Task<HttpStatusCode> CallAsync(string token)
    {
        var context = await app!.GetTestServer().SendAsync(
            http =>
            {
                http.Request.Method = HttpMethods.Post;
                http.Request.Path = Route;
                if (token.Length > 0)
                {
                    http.Request.Headers.Authorization = $"Bearer {token}";
                }
            },
            TestContext.Current.CancellationToken);
        return (HttpStatusCode)context.Response.StatusCode;
    }
}
