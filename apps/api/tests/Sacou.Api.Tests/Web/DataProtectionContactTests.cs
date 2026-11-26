using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Sacou.Api.Web;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>E6.4, S2: the data protection contact of <c>/excluir-conta</c>, from the settings only, checked on start.</summary>
public sealed class DataProtectionContactTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Page = "/excluir-conta";
    private const string Contact = "encarregado@exemplo.org";
    private const string Setting = DataProtectionOptionsValidator.Key;

    [Theory]
    [InlineData("encarregado@exemplo.org")]
    [InlineData("Encarregado@Exemplo.org")]
    [InlineData("  encarregado@exemplo.org  ")]
    [InlineData("dados+sacou@sub.exemplo.com.br")]
    public void APlainEmail_IsAccepted_InAnyEnvironment(string value)
    {
        foreach (var environment in new[] { Environments.Development, Environments.Staging, Environments.Production })
        {
            Assert.True(Validate(environment, value).Succeeded);
        }
    }

    [Theory]
    [InlineData("a@b")]
    [InlineData("a@b.c\"><script>")]
    [InlineData("a@b.c?cc=x@y.z")]
    [InlineData("a b@c.d")]
    [InlineData("a@b.c,x@y.z")]
    [InlineData("a%40b@c.d")]
    [InlineData("a@b.c&body=x")]
    [InlineData("a@-b.c")]
    [InlineData("@b.c")]
    [InlineData("a@b.c\nBcc: x@y.z")]
    public void AnythingElse_StopsTheStart_InAnyEnvironment_WithoutTheValue(string value)
    {
        foreach (var environment in new[] { Environments.Development, Environments.Staging, Environments.Production })
        {
            var result = Validate(environment, value);

            Assert.True(result.Failed);
            Assert.Equal(DataProtectionOptionsValidator.NotAnEmail, result.FailureMessage);
            Assert.Equal("DataProtection:ContactEmail must be an e-mail address.", result.FailureMessage);
        }
    }

    [Fact]
    public void TheLongestAddress_Is254Characters()
    {
        const string Domain = "@exemplo.org";
        var longest = new string('a', DataProtectionOptionsValidator.MaxLength - Domain.Length) + Domain;

        Assert.True(Validate(Environments.Staging, longest).Succeeded);
        Assert.True(Validate(Environments.Staging, "a" + longest).Failed);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Empty_StopsOnlyProduction(string? value)
    {
        var production = Validate(Environments.Production, value);

        Assert.True(production.Failed);
        Assert.Equal("DataProtection:ContactEmail is required in Production.", production.FailureMessage);
        Assert.True(Validate(Environments.Staging, value).Succeeded);
        Assert.True(Validate(Environments.Development, value).Succeeded);
    }

    [Fact]
    public async Task WithTheContact_TheBlockShowsTheAddress_AndTheMailto_InTheSectionWithoutTheApp()
    {
        await using var app = App("Encarregado@Exemplo.org");
        using var client = app.CreateClient();

        var html = await client.GetStringAsync(
            new Uri(Page + "?subject=ZZSUBJECT&cc=zz@evil.example", UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Contains(
            $"<a href=\"mailto:{Contact}?subject=Excluir%20minha%20conta%20do%20Sacou\">{Contact}</a>", html, StringComparison.Ordinal);
        Assert.Equal(2, html.Split("mailto:").Length);
        Assert.DoesNotContain("ZZSUBJECT", html, StringComparison.Ordinal);
        Assert.DoesNotContain("evil.example", html, StringComparison.Ordinal);
        Assert.DoesNotContain(WebTexts.DeletionRequestUnavailable, html, StringComparison.Ordinal);
        var mailTo = html.IndexOf("mailto:", StringComparison.Ordinal);
        Assert.True(html.IndexOf("<h2>Sem o app</h2>", StringComparison.Ordinal) < mailTo);
        Assert.True(mailTo < html.IndexOf("<h2>O que é apagado</h2>", StringComparison.Ordinal));
        Assert.Single(html.Split("15 dias").Skip(1));
    }

    [Theory]
    [InlineData("Envie do mesmo e-mail que você usa para entrar no Sacou.")]
    [InlineData("Diga o seu apelido no Sacou.")]
    [InlineData("em até 15 dias")]
    [InlineData("Um pedido de outro endereço recebe uma resposta pedindo que você escreva do e-mail da conta.")]
    public async Task WithTheContact_TheBlockSaysHowToAsk(string text)
    {
        await using var app = App(Contact);
        using var client = app.CreateClient();

        var html = await client.GetStringAsync(new Uri(Page, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Contains(text, html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task AnInvalidContact_StopsTheStart_WithTheKey_ButNotTheValue()
    {
        await using var app = App("zzsecret@b.c\"><script>");

        var error = Assert.ThrowsAny<Exception>(() => app.CreateClient());

        var message = Flatten(error);
        Assert.Contains(DataProtectionOptionsValidator.NotAnEmail, message, StringComparison.Ordinal);
        Assert.DoesNotContain("zzsecret", message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Production_WithoutTheContact_DoesNotStart()
    {
        await using var production = new SacouApiFactory { Environment = Environments.Production, ContactEmail = "" };

        var error = Assert.ThrowsAny<Exception>(() => production.CreateClient());

        Assert.Contains(DataProtectionOptionsValidator.RequiredInProduction, Flatten(error), StringComparison.Ordinal);
    }

    private WebApplicationFactory<Program> App(string contact) =>
        RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()))
            .WithWebHostBuilder(builder => builder.UseSetting(Setting, contact));

    private static ValidateOptionsResult Validate(string environment, string? value) =>
        new DataProtectionOptionsValidator(new Environment(environment)).Validate(null, new DataProtectionOptions { ContactEmail = value });

    private static string Flatten(Exception error) =>
        error.InnerException is null ? error.Message : error.Message + " | " + Flatten(error.InnerException);

    private sealed class Environment(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;

        public string ApplicationName { get; set; } = "Sacou.Api";

        public string ContentRootPath { get; set; } = "";

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
