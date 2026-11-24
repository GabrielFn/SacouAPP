using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Sacou.Api.Observability;
using Xunit;

namespace Sacou.Api.Tests.Observability;

/// <summary>Cases 1 to 8 of the plan (E5.2, Part 1): what reaches Sentry, once, without personal data.</summary>
[Collection(SentrySequence.Name)]
public sealed partial class SentryReportingTests
{
    private const string Staging = "Staging";
    private const string BearerMarker = "eyJmarcadorCabecalho.eyJmarcadorCorpo.assinaturaMarcador";
    private const string EmailMarker = "marcador@example.com";
    private const string NicknameMarker = "MarcadorApelido";
    private const string CookieMarker = "CookieMarcador";

    /// <summary>Case 1: without the DSN the API starts, says so by the variable's name, and has no Sentry hub.</summary>
    [Fact]
    public async Task WithoutTheDsn_TheApiStartsAndWarnsByName()
    {
        using var logs = new Sacou.Tests.TestSupport.CollectingLoggerProvider();
        await using var api = new SacouApiFactory();
        await using var factory = api.WithWebHostBuilder(builder => builder.ConfigureLogging(logging => logging.AddProvider(logs)));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(logs.Entries, entry => entry.Contains($"Sentry is off: {ObservabilitySetup.SentryDsnVariable} is not set.", StringComparison.Ordinal));
        Assert.Null(factory.Services.GetService<IHub>());
    }

    /// <summary>Case 2: one event, in staging, tagged with the trace of the ProblemDetails.</summary>
    [Fact]
    public async Task DeliberateFailure_InStaging_SendsOneEventWithTheTraceOfTheResponse()
    {
        await using var api = new SentryTestApi(Staging);
        using var client = api.Factory.CreateClient();

        using var response = await client.GetAsync(DeliberateFailureEndpoint.Route, TestContext.Current.CancellationToken);

        // No flush here: the API waits for the event before the 500 completes (R1).
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var envelope = Assert.Single(api.Transport.Events);
        var sentryEvent = EventJson(envelope);
        Assert.Equal("staging", sentryEvent.GetProperty("environment").GetString());
        var traceId = sentryEvent.GetProperty("tags").GetProperty(SentryEventScrubber.TraceIdTag).GetString();
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        Assert.Contains($"-{traceId}-", problem.RootElement.GetProperty("traceId").GetString(), StringComparison.Ordinal);
        Assert.Equal(DeliberateFailureEndpoint.Route, sentryEvent.GetProperty("request").GetProperty("url").GetString());
        Assert.Contains(nameof(DeliberateFailureException), envelope, StringComparison.Ordinal);
    }

    /// <summary>Case 3: the route does not exist in Production.</summary>
    [Fact]
    public async Task DeliberateFailure_InProduction_IsNotMapped()
    {
        await using var api = new SentryTestApi("Production");
        using var client = api.Factory.CreateClient();

        using var response = await client.GetAsync(DeliberateFailureEndpoint.Route, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await api.FlushAsync();
        Assert.Empty(api.Transport.Events);
    }

    /// <summary>Case 4: without a token the route is a 401, and a 401 is no event.</summary>
    [Fact]
    public async Task DeliberateFailure_WithoutAToken_IsA401AndNoEvent()
    {
        await using var api = new SentryTestApi(Staging, signedIn: false);
        using var client = api.Factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, DeliberateFailureEndpoint.Route);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", BearerMarker);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await api.FlushAsync();
        Assert.Empty(api.Transport.Events);
    }

    /// <summary>Case 5: the token, a cookie, the query, the body and the user never leave; the URL is the route template.</summary>
    [Fact]
    public async Task FailingRequest_CarriesNoneOfItsPersonalData()
    {
        await using var api = new SentryTestApi(Staging);
        using var client = api.Factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{DeliberateFailureEndpoint.Route}?email={EmailMarker}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", BearerMarker);
        request.Headers.Add("Cookie", $"session={CookieMarker}");
        request.Headers.UserAgent.ParseAdd("MarcadorAgente/1.0");
        request.Content = new StringContent($$"""{"nickname":"{{NicknameMarker}}"}""", Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var envelope = Assert.Single(api.Transport.Events);
        foreach (var marker in new[] { "eyJmarcador", "assinaturaMarcador", EmailMarker, NicknameMarker, CookieMarker, "MarcadorAgente", "uid-sentry", "127.0.0.1" })
        {
            Assert.DoesNotContain(marker, envelope, StringComparison.OrdinalIgnoreCase);
        }

        var sentryEvent = EventJson(envelope);
        Assert.False(sentryEvent.TryGetProperty("user", out _));
        Assert.False(sentryEvent.TryGetProperty("server_name", out _));
        Assert.False(sentryEvent.GetProperty("request").TryGetProperty("query_string", out _));
        Assert.False(sentryEvent.GetProperty("request").TryGetProperty("cookies", out _));
    }

    /// <summary>Case 7: a 404 of a filled path (it carries a code) is no event.</summary>
    [Fact]
    public async Task ClientErrors_AreNoEvent()
    {
        await using var api = new SentryTestApi(Staging);
        using var client = api.Factory.CreateClient();

        using var missing = await client.GetAsync("/nao-existe/CODIGOMARCADOR", TestContext.Current.CancellationToken);
        using var invalid = await client.PostAsync("/v1/groups", new StringContent("{", Encoding.UTF8, "application/json"), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        await api.FlushAsync();
        Assert.Empty(api.Transport.Events);
    }

    /// <summary>Case 8: a warning of the API is a breadcrumb of the next event, never an event of its own.</summary>
    [Fact]
    public async Task Warning_IsABreadcrumbNotAnEvent()
    {
        await using var api = new SentryTestApi(Staging);
        var hub = api.Factory.Services.GetRequiredService<IHub>();
        var logger = api.Factory.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Sacou.Tests.Probe");

        ProbeWarning(logger, EmailMarker);
        await api.FlushAsync();
        Assert.Empty(api.Transport.Events);

        ProbeError(logger);
        await hub.FlushAsync(TimeSpan.FromSeconds(5));

        var envelope = Assert.Single(api.Transport.Events);
        Assert.Contains("Erro de teste", envelope, StringComparison.Ordinal);
        Assert.Contains("Aviso de teste para [filtrado]", envelope, StringComparison.Ordinal);
        Assert.DoesNotContain(EmailMarker, envelope, StringComparison.Ordinal);
    }

    /// <summary>D1: a DSN out of shape stops the start, by the variable's name only.</summary>
    [Fact]
    public async Task InvalidDsn_StopsTheStartWithoutItsValue()
    {
        const string invalid = "http://segredo-marcador@sentry.invalid/1";
        await using var api = new SacouApiFactory();
        await using var factory = api.WithWebHostBuilder(builder => builder.UseSetting(ObservabilitySetup.SentryDsnVariable, invalid));

        var error = Assert.Throws<InvalidOperationException>(() => factory.Services);

        Assert.Contains(ObservabilitySetup.SentryDsnVariable, error.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("segredo-marcador", error.Message, StringComparison.Ordinal);
    }

    /// <summary>The payload of the event item: the line after the item header <c>{"type":"event",...}</c>.</summary>
    private static JsonElement EventJson(string envelope)
    {
        var lines = envelope.Split('\n');
        var header = Array.FindIndex(lines, line => line.Contains("\"type\":\"event\"", StringComparison.Ordinal));
        Assert.True(header >= 0, "The envelope has no event item.");
        using var document = JsonDocument.Parse(lines[header + 1]);
        return document.RootElement.Clone();
    }

    [LoggerMessage(EventId = 9001, Level = LogLevel.Warning, Message = "Aviso de teste para {Email}")]
    private static partial void ProbeWarning(ILogger logger, string email);

    [LoggerMessage(EventId = 9002, Level = LogLevel.Error, Message = "Erro de teste")]
    private static partial void ProbeError(ILogger logger);
}
