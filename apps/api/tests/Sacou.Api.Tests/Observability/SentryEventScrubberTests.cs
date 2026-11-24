using System.Text;
using System.Text.Json;
using Sacou.Api.Observability;
using Sentry.Protocol;
using Xunit;

namespace Sacou.Api.Tests.Observability;

/// <summary>Cases 5 and 6 of the plan at the unit level: the allow list of the event and of the breadcrumb (D4).</summary>
public sealed class SentryEventScrubberTests
{
    private const string Email = "marcador@example.com";
    private const string Jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJtYXJjYWRvciJ9.assinatura";
    private const string Pix = "00020126580014br.gov.bcb.pix0136chave-marcador5204000053039865802BR";

    [Fact]
    public void Scrub_KeepsOnlyTheListedFields()
    {
        var original = HostileEvent();

        var json = Json(SentryEventScrubber.Scrub(original));

        foreach (var marker in new[] { Email, "eyJhbGci", "chave-marcador", "ApelidoMarcador", "CookieMarcador", "AgenteMarcador", "10.1.2.3", "servidor-marcador", "codigo=ABC123", "ExtraMarcador", "TagMarcador" })
        {
            Assert.DoesNotContain(marker, json, StringComparison.Ordinal);
        }

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Assert.False(root.TryGetProperty("user", out _));
        Assert.False(root.TryGetProperty("extra", out _));
        Assert.False(root.TryGetProperty("server_name", out _));
        var request = root.GetProperty("request");
        Assert.Equal("/r/{code}", request.GetProperty("url").GetString());
        Assert.Equal("POST", request.GetProperty("method").GetString());
        Assert.Equal(["Content-Type"], request.GetProperty("headers").EnumerateObject().Select(header => header.Name));
        Assert.Equal(["route", "trace_id"], root.GetProperty("tags").EnumerateObject().Select(tag => tag.Name).Order(StringComparer.Ordinal));
        Assert.Contains("[filtrado]", root.GetProperty("exception").GetProperty("values")[0].GetProperty("value").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public void Scrub_FiltersTheMessageAndTheBreadcrumbs()
    {
        var json = Json(SentryEventScrubber.Scrub(HostileEvent()));

        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        Assert.Equal("Falha para [filtrado] com [filtrado]", root.GetProperty("logentry").GetProperty("formatted").GetString());
        var breadcrumb = root.GetProperty("breadcrumbs")[0];
        Assert.Equal("Chamada de [filtrado]", breadcrumb.GetProperty("message").GetString());
        Assert.Equal("https://exp.host/push", breadcrumb.GetProperty("data").GetProperty("url").GetString());
        Assert.False(breadcrumb.GetProperty("data").TryGetProperty("body", out _));
    }

    [Fact]
    public void Scrub_DoesNotChangeTheOriginal()
    {
        var original = HostileEvent();

        _ = SentryEventScrubber.Scrub(original);

        Assert.Equal(Email, original.User.Email);
        Assert.Equal("https://api.sacou.test/r/ABC123?codigo=ABC123", original.Request.Url);
    }

    [Fact]
    public void Scrub_WithoutRouteTag_UsesTheUnmatchedUrl()
    {
        var sentryEvent = new SentryEvent { Request = new SentryRequest { Url = "https://api.sacou.test/c/ABC123", Method = "GET" } };

        var json = Json(SentryEventScrubber.Scrub(sentryEvent));

        Assert.Contains(RouteTemplateUrl.Unmatched, json, StringComparison.Ordinal);
        Assert.DoesNotContain("ABC123", json, StringComparison.Ordinal);
    }

    [Fact]
    public void ScrubBreadcrumb_FiltersTheMessageAndTheUrlAndDropsUnlistedData()
    {
        var breadcrumb = new Breadcrumb(
            $"Token {Jwt}",
            "http",
            new Dictionary<string, string>(StringComparer.Ordinal) { ["url"] = "https://exp.host/push?token=segredo", ["method"] = "POST", ["body"] = Email },
            "http",
            BreadcrumbLevel.Info);

        var scrubbed = SentryEventScrubber.Scrub(breadcrumb);

        Assert.Equal("Token [filtrado]", scrubbed.Message);
        Assert.Equal("https://exp.host/push", scrubbed.Data!["url"]);
        Assert.Equal("POST", scrubbed.Data["method"]);
        Assert.False(scrubbed.Data.ContainsKey("body"));
        Assert.Equal("http", scrubbed.Category);
    }

    [Theory]
    [InlineData("Sacou.Modules.Groups.Access", true)]
    [InlineData("http", true)]
    [InlineData("Microsoft.AspNetCore.Hosting.Diagnostics", false)]
    [InlineData("Microsoft.EntityFrameworkCore.Database.Command", false)]
    [InlineData(null, false)]
    public void IsAllowedBreadcrumb_OnlyTheApiAndItsHttpCalls(string? category, bool allowed) =>
        Assert.Equal(allowed, ObservabilitySetup.IsAllowedBreadcrumb(category));

    [Theory]
    [InlineData("https://publickey@o1.ingest.us.sentry.io/123", true)]
    [InlineData("http://publickey@o1.ingest.us.sentry.io/123", false)]
    [InlineData("https://o1.ingest.us.sentry.io/123", false)]
    [InlineData("https://publickey@o1.ingest.us.sentry.io/", false)]
    [InlineData("not a dsn", false)]
    public void IsValidDsn_NeedsHttpsAKeyAndAProject(string dsn, bool valid) =>
        Assert.Equal(valid, ObservabilitySetup.IsValidDsn(dsn));

    private static SentryEvent HostileEvent()
    {
        var sentryEvent = new SentryEvent(new InvalidOperationException($"Falhou para {Email} e {Pix}"))
        {
            Message = $"Falha para {Email} com {Jwt}",
            ServerName = "servidor-marcador",
            User = new SentryUser { Email = Email, IpAddress = "10.1.2.3", Username = "ApelidoMarcador", Id = "uid-marcador" },
            Request = new SentryRequest
            {
                Url = "https://api.sacou.test/r/ABC123?codigo=ABC123",
                Method = "POST",
                QueryString = "codigo=ABC123",
                Cookies = "session=CookieMarcador",
                Data = """{"nickname":"ApelidoMarcador"}""",
            },
        };
        sentryEvent.SentryExceptions = [new SentryException { Type = typeof(InvalidOperationException).FullName, Value = $"Falhou para {Email} e {Pix}" }];
        sentryEvent.Request.Headers["Content-Type"] = "application/json";
        sentryEvent.Request.Headers["User-Agent"] = "AgenteMarcador";
        sentryEvent.Request.Headers["Authorization"] = $"Bearer {Jwt}";
        sentryEvent.SetTag(SentryEventScrubber.TraceIdTag, "0123456789abcdef0123456789abcdef");
        sentryEvent.SetTag(SentryEventScrubber.RouteTag, "/r/{code}");
        sentryEvent.SetTag("apelido", "TagMarcador");
        sentryEvent.SetExtra("Nickname", "ExtraMarcador");
        sentryEvent.AddBreadcrumb(new Breadcrumb(
            $"Chamada de {Email}",
            "http",
            new Dictionary<string, string>(StringComparer.Ordinal) { ["url"] = "https://exp.host/push?to=ExponentPushToken", ["body"] = "ApelidoMarcador" },
            "http",
            BreadcrumbLevel.Info));
        return sentryEvent;
    }

    private static string Json(SentryEvent sentryEvent)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            sentryEvent.WriteTo(writer, logger: null);
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }
}
