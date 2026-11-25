using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Sacou.Api.Tests;

/// <summary>
/// The MVP vote routes behind the <c>MvpVote</c> flag (ADR 0084, D5): with the flag off, a refused caller is still 401, and a
/// signed-in non-member gets 404 <c>api.feature-disabled</c> without the database being read (it is closed in this factory).
/// </summary>
public sealed class FlaggedMvpVotingTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string FlagSetting = "AppConfig:Features:MvpVote";
    private static readonly string Voting = $"/v1/groups/{Guid.NewGuid()}/rounds/{Guid.NewGuid()}/mvp-voting";

    public static readonly TheoryData<string, string> Routes = new()
    {
        { "GET", "" },
        { "POST", "/vote" },
        { "GET", "/result" },
    };

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task FlagOff_WithoutAToken_Is401NotAFeatureAnswer(string method, string suffix)
    {
        await using var off = factory.WithWebHostBuilder(builder => builder.UseSetting(FlagSetting, "false"));
        using var client = off.CreateClient();

        using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), Voting + suffix), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task FlagOff_WithAMalformedToken_Is401(string method, string suffix)
    {
        await using var off = factory.WithWebHostBuilder(builder => builder.UseSetting(FlagSetting, "false"));
        using var client = off.CreateClient();
        using var request = new HttpRequestMessage(new HttpMethod(method), Voting + suffix);
        request.Headers.TryAddWithoutValidation("Authorization", "Bearer not-a-jwt");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task FlagOff_SignedInNonMember_Is404FeatureDisabledWithoutTheDatabase(string method, string suffix)
    {
        await using var off = SignedIn(factory.WithWebHostBuilder(builder => builder.UseSetting(FlagSetting, "false")));
        using var client = off.CreateClient();

        using var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), Voting + suffix), TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("api.feature-disabled", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task FlagOn_SignedInNonMember_ReachesTheDatabaseTheControl()
    {
        await using var on = SignedIn(factory.WithWebHostBuilder(builder => builder.UseSetting(FlagSetting, "true")));
        using var client = on.CreateClient();

        using var response = await client.GetAsync(Voting, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    private static WebApplicationFactory<Program> SignedIn(WebApplicationFactory<Program> source) =>
        source.WithWebHostBuilder(builder => builder.ConfigureServices(services => services
            .AddAuthentication()
            .AddScheme<AuthenticationSchemeOptions, SignedInScheme>(SignedInScheme.Name, null)
            .Services.PostConfigure<AuthenticationOptions>(options => options.DefaultScheme = SignedInScheme.Name)));

    private sealed class SignedInScheme(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public const string Name = "SignedIn";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "uid-not-a-member")], Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Name)));
        }
    }
}
