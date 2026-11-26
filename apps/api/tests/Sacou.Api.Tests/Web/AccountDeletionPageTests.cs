using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Api.Web;
using Sacou.Api.Web.Legal;
using Sacou.Http.RateLimiting;
using Xunit;

namespace Sacou.Api.Tests.Web;

/// <summary>E6.4, S1: <c>/excluir-conta</c>, the web link of the Play, with the text of <c>docs/legal/exclusao-de-conta.md</c>.</summary>
public sealed class AccountDeletionPageTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    private const string Page = "/excluir-conta";
    private const string Hostile = "<img src=x onerror=alert(1)>";
    private const int PermitLimit = 60;

    private static readonly string[] Sections =
        ["Pelo app", "Sem o app", "O que é apagado", "O que fica e por quanto tempo", "Antes de excluir"];

    [Fact]
    public async Task Page_IsTheRealText_WithVersionAndDate_WithoutSignIn()
    {
        var (response, html) = await GetAsync(Page);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html; charset=utf-8", response.Content.Headers.ContentType?.ToString());
        Assert.Contains("<html lang=\"pt-BR\">", html, StringComparison.Ordinal);
        Assert.Contains("<title>Excluir sua conta do Sacou</title>", html, StringComparison.Ordinal);
        Assert.Contains("<h1>Excluir sua conta do Sacou</h1>", html, StringComparison.Ordinal);
        Assert.Contains($"<p class=\"legal-brand\">{WebTexts.Brand}</p>", html, StringComparison.Ordinal);
        Assert.Contains("Versão 0.1 (rascunho) · atualizada em 26/11/2026", html, StringComparison.Ordinal);
        Assert.Contains($"<link rel=\"stylesheet\" href=\"{RoundPageFixture.LegalStyle}\">", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
        foreach (var note in new[] { "LACUNA", "CONFERIR", "Conferir", "RASCUNHO PARA REVISÃO", "NOTA", "pergunta 19", "publicar:" })
        {
            Assert.DoesNotContain(note, html, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Head_Is200_WithTheLegalHeaders()
    {
        await using var app = App();
        using var client = app.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Head, new Uri(Page, UriKind.Relative));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        // Kestrel drops the body of a HEAD; the test server does not, so only the status and the headers are checked.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(WebSecurityHeaders.LegalContentSecurityPolicy, Header(response, "Content-Security-Policy"));
    }

    [Fact]
    public async Task Sections_ComeInTheOrderThePlayAsksFor()
    {
        var (_, html) = await GetAsync(Page);

        var positions = Sections.Select(section => html.IndexOf($"<h2>{section}</h2>", StringComparison.Ordinal)).ToList();

        Assert.DoesNotContain(-1, positions);
        Assert.Equal(positions.Order().ToList(), positions);
    }

    [Theory]
    [InlineData("toque na aba &quot;Eu&quot;")]
    [InlineData("Toque em &quot;Configurações&quot;")]
    [InlineData("Em &quot;Excluir conta&quot;, toque em &quot;Excluir&quot;")]
    [InlineData("Em &quot;Para confirmar, digite EXCLUIR&quot;")]
    [InlineData("toque em &quot;Excluir minha conta&quot;")]
    [InlineData("&quot;Sua senha&quot;")]
    [InlineData("&quot;Confirmar e excluir&quot;")]
    [InlineData("&quot;Escolher outro admin&quot;")]
    [InlineData("A exclusão não dá para desfazer.")]
    public async Task Steps_UseTheLabelsOfTheApp(string text)
    {
        var (_, html) = await GetAsync(Page);

        Assert.Contains(text, html, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("O login e o e-mail guardados no Firebase")]
    [InlineData("A sua conta na API do Sacou.")]
    [InlineData("O seu perfil: apelido, posições e o nível")]
    [InlineData("As notas que admins deram sobre você.")]
    [InlineData("Os aparelhos cadastrados para as notificações")]
    [InlineData("As denúncias feitas por você ou sobre você.")]
    [InlineData("Os convites criados por você")]
    [InlineData("&quot;Ex-jogador&quot;")]
    [InlineData("enquanto o grupo existir")]
    [InlineData("por até 30 dias")]
    [InlineData("por 6 horas")]
    [InlineData("fica por 60 dias")]
    [InlineData("com endereço IP e navegador, ficam por 30 dias")]
    [InlineData("ficam por 90 dias, sem nada que identifique você")]
    public async Task Text_SaysWhatIsErased_AndWhatStays_WithTheDeadlines(string text)
    {
        var (_, html) = await GetAsync(Page);

        Assert.Contains(text, html, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(Page)]
    [InlineData("/EXCLUIR-CONTA")]
    [InlineData("/Excluir-Conta")]
    public async Task Page_HasTheLegalHeaders_InAnyCase(string path)
    {
        var (response, _) = await GetAsync(path);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(WebSecurityHeaders.LegalContentSecurityPolicy, Header(response, "Content-Security-Policy"));
        Assert.Equal("nosniff", Header(response, "X-Content-Type-Options"));
        Assert.Equal("DENY", Header(response, "X-Frame-Options"));
        Assert.Equal("strict-origin", Header(response, "Referrer-Policy"));
        Assert.Equal("noindex, nofollow", Header(response, "X-Robots-Tag"));
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task AnotherSegment_Is401_WithoutThePageCsp()
    {
        var (response, _) = await GetAsync("/excluir-contas");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(WebSecurityHeaders.LegalContentSecurityPolicy, Header(response, "Content-Security-Policy"));
    }

    [Theory]
    [InlineData("/excluir-conta/x")]
    [InlineData("/AccountDeletion")]
    public async Task OtherPaths_Are401_WithNothingDrawn(string path)
    {
        var (response, html) = await GetAsync(path);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.DoesNotContain(WebTexts.Brand, html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Post_Is401_WithNothingDrawn()
    {
        await using var app = App();
        using var client = app.CreateClient();
        using var content = new StringContent("x=1");

        using var response = await client.PostAsync(new Uri(Page, UriKind.Relative), content, TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.DoesNotContain(WebTexts.Brand, body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Query_IsNotReflected()
    {
        var (_, html) = await GetAsync(Page + "?x=%3Cscript%3EZZQUERY");

        Assert.DoesNotContain("ZZQUERY", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task WithoutTheContact_TheBlockSaysTheEmailIsNotAvailable_AndHasNoMailto()
    {
        var (_, html) = await GetAsync(Page);

        Assert.Contains($"<h2 id=\"legal-request-title\">{WebTexts.DeletionRequestTitle}</h2>", html, StringComparison.Ordinal);
        Assert.Contains(
            "O pedido por e-mail ainda não está disponível. Por enquanto, exclua pelo app.", html, StringComparison.Ordinal);
        Assert.DoesNotContain("mailto:", html, StringComparison.Ordinal);
        Assert.True(
            html.IndexOf("legal-request", StringComparison.Ordinal) < html.IndexOf("<h2>Pelo app</h2>", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Footer_LinksThePrivacyPolicy()
    {
        var (_, html) = await GetAsync(Page);

        Assert.Contains("<a href=\"/privacidade\">Política de Privacidade</a>", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task HostileText_IsEncoded_ThePageDoesNotTrustTheReader()
    {
        var hostile = new LegalDocument(
            Hostile,
            Hostile,
            new DateOnly(2026, 11, 26),
            [new LegalBlock.Heading(2, Hostile), new LegalBlock.Paragraph(Hostile), new LegalBlock.BulletList([Hostile])]);
        await using var app = App(services => services.AddSingleton<ILegalDocuments>(new FakeDocuments(hostile)));
        using var client = app.CreateClient();

        var html = await client.GetStringAsync(new Uri(Page, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.DoesNotContain("<img", html, StringComparison.Ordinal);
        Assert.Contains("&lt;img src=x onerror=alert(1)&gt;", html, StringComparison.Ordinal);
    }

    [Fact]
    public async Task SixtyFirstLegalPageOfOneAddress_Is429_AndAnotherAddressPasses()
    {
        await using var api = new SacouApiFactory();
        await using var app = RoundPageFixture.Factory(api, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        using var client = app.CreateClient();
        string[] pages = ["/termos", "/privacidade", Page];

        for (var request = 0; request < PermitLimit; request++)
        {
            using var allowed = await GetFromAsync(client, pages[request % pages.Length], "203.0.113.9");
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }

        using var refused = await GetFromAsync(client, Page, "203.0.113.9");
        using var other = await GetFromAsync(client, Page, "198.51.100.11");
        var body = await refused.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.True(refused.Headers.Contains("Retry-After"));
        Assert.Contains("Muitas tentativas", body, StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, other.StatusCode);
    }

    [Fact]
    public async Task AnInvalidText_StopsTheStart_WithTheFileAndTheLine()
    {
        const string Invalid = "<!-- publicar:inicio -->\n# Título\nVersão: 0.1\nAtualizada em: 26/11/2026\n<b>ZZSECRET</b>\n<!-- publicar:fim -->";
        var source = new OneFileSource(LegalDocuments.AccountDeletionFile, Invalid);
        await using var app = App(services => services.AddSingleton<ILegalDocumentSource>(source));

        var error = Assert.ThrowsAny<Exception>(() => app.CreateClient());

        var message = Flatten(error);
        Assert.Contains($"docs/legal/{LegalDocuments.AccountDeletionFile}, line 5", message, StringComparison.Ordinal);
        Assert.DoesNotContain("ZZSECRET", message, StringComparison.Ordinal);
    }

    private async Task<(HttpResponseMessage Response, string Html)> GetAsync(string path)
    {
        await using var app = App();
        using var client = app.CreateClient();
        var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        var html = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return (response, html);
    }

    private WebApplicationFactory<Program> App(Action<IServiceCollection>? replace = null)
    {
        var app = RoundPageFixture.Factory(factory, RoundPageFixture.One(RoundPageFixture.NineOfTwelve()));
        return replace is null ? app : app.WithWebHostBuilder(builder => builder.ConfigureTestServices(replace));
    }

    private static async Task<HttpResponseMessage> GetFromAsync(HttpClient client, string path, string address)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(path, UriKind.Relative));
        request.Headers.Add(ClientAddressKey.ForwardedFor, address);
        var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        await response.Content.LoadIntoBufferAsync(TestContext.Current.CancellationToken);
        return response;
    }

    private static string Flatten(Exception error) =>
        error.InnerException is null ? error.Message : error.Message + " | " + Flatten(error.InnerException);

    private static string Header(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues(name, out var values) ? string.Join(",", values) : string.Empty;

    private sealed class FakeDocuments(LegalDocument document) : ILegalDocuments
    {
        public LegalDocument Terms => document;

        public LegalDocument Privacy => document;

        public LegalDocument AccountDeletion => document;
    }

    /// <summary>The real texts, but one file replaced: only that one is refused.</summary>
    private sealed class OneFileSource(string fileName, string content) : ILegalDocumentSource
    {
        private readonly EmbeddedLegalDocumentSource embedded = new();

        public string Read(string name) => name == fileName ? content : embedded.Read(name);
    }
}
