using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Logging;
using Sacou.Modules.Identity;
using Xunit;

namespace Sacou.Api.Tests;

/// <summary>How Program.cs puts the API together: secure by default, ProblemDetails, start-up checks.</summary>
public sealed class CompositionTests
{
    private const string SignInPath = "/v1/me";

    /// <summary>C2: no token, no entry, with a ProblemDetails body and a bare Bearer challenge.</summary>
    [Fact]
    public async Task SignIn_WithoutAToken_IsUnauthorizedProblemDetails()
    {
        await using var factory = new SacouApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.PostAsync(SignInPath, content: null, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Bearer", Assert.Single(response.Headers.WwwAuthenticate).ToString());
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    /// <summary>
    /// C3: the API refuses to start, naming the key and never the value. Runs the same start-up validator
    /// the host runs (<c>ValidateOnStart</c>), on the module composition, so no host races its disposal.
    /// </summary>
    [Theory]
    [InlineData("")]
    [InlineData("Sacou")]
    [InlineData("ab")]
    [InlineData("with_underscore")]
    [InlineData("SET-THE-PROJECT-ID")]
    public void InvalidProjectId_StopsTheStart(string projectId)
    {
        using var services = Composition(projectId);

        var failure = Assert.Throws<OptionsValidationException>(() => services.GetRequiredService<IStartupValidator>().Validate());

        Assert.Contains("Firebase:ProjectId", failure.Message, StringComparison.Ordinal);
        if (projectId.Length > 0)
        {
            Assert.DoesNotContain(projectId, failure.Message, StringComparison.Ordinal);
        }
    }

    [Fact]
    public void ValidProjectId_PassesTheStartUpValidation()
    {
        using var services = Composition(SacouApiFactory.TestProjectId);

        services.GetRequiredService<IStartupValidator>().Validate();
    }

    [Fact]
    public void RealAppSettings_HoldAValidProjectId()
    {
        var settings = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        Assert.Equal("sacou-79493", settings["Firebase:ProjectId"]);
    }

    /// <summary>C4: an endpoint without its own policy still needs a signed-in user.</summary>
    [Fact]
    public async Task FallbackPolicy_RequiresAnAuthenticatedUser()
    {
        await using var factory = new SacouApiFactory();
        var options = factory.Services.GetRequiredService<IOptions<AuthorizationOptions>>().Value;

        var requirement = Assert.Single(options.FallbackPolicy!.Requirements);
        Assert.IsType<Microsoft.AspNetCore.Authorization.Infrastructure.DenyAnonymousAuthorizationRequirement>(requirement);
    }

    [Fact]
    public async Task DefaultScheme_IsTheFirebaseOne()
    {
        await using var factory = new SacouApiFactory();
        var schemes = factory.Services.GetRequiredService<IAuthenticationSchemeProvider>();

        var scheme = await schemes.GetDefaultAuthenticateSchemeAsync();

        Assert.Equal(IdentityModule.AuthenticationScheme, scheme?.Name);
    }

    /// <summary>L2: IdentityModel never logs personal data or whole tokens.</summary>
    [Fact]
    public async Task AfterComposition_IdentityModelLogsNoPersonalData()
    {
        await using var factory = new SacouApiFactory();
        _ = factory.Services;

        Assert.False(IdentityModelEventSource.ShowPII);
        Assert.False(IdentityModelEventSource.LogCompleteSecurityArtifact);
    }

    /// <summary>P7: the database down gives a bare 500, with nothing about the connection or the exception.</summary>
    [Fact]
    public async Task DatabaseDown_IsABare500InProduction()
    {
        await using var production = new SacouApiFactory { Environment = "Production" };
        await using var factory = production.WithWebHostBuilder(builder => builder.ConfigureServices(services => services
                .AddAuthentication()
                .AddScheme<AuthenticationSchemeOptions, SignedInScheme>(SignedInScheme.Name, null)
                .Services.PostConfigure<AuthenticationOptions>(options => options.DefaultScheme = SignedInScheme.Name)));
        using var client = factory.CreateClient();

        using var response = await client.PostAsync(SignInPath, content: null, TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain("127.0.0.1", body, StringComparison.Ordinal);
        Assert.DoesNotContain("Host=", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Npgsql", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Exception", body, StringComparison.Ordinal);
    }

    private static ServiceProvider Composition(string projectId)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Firebase:ProjectId"] = projectId })
            .Build();
        return new ServiceCollection().AddLogging().AddIdentityModule(configuration).BuildServiceProvider();
    }

    /// <summary>Signs every request in as a fixed subject, so the request reaches the database.</summary>
    private sealed class SignedInScheme(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        Microsoft.Extensions.Logging.ILoggerFactory logger,
        System.Text.Encodings.Web.UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public const string Name = "SignedIn";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "uid-down")], Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Name)));
        }
    }
}
