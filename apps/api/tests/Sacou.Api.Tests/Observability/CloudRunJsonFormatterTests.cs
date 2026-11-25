using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;
using Sacou.Api.Observability;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Api.Tests.Observability;

/// <summary>Cases 9 and 10 of the plan: one JSON line per log, in the shape of Cloud Logging (D5).</summary>
public sealed class CloudRunJsonFormatterTests
{
    private const string ProjectId = "sacou-projeto";
    private const string Category = "Sacou.Tests.Formatter";

    [Theory]
    [InlineData(LogLevel.Trace, "DEBUG")]
    [InlineData(LogLevel.Debug, "DEBUG")]
    [InlineData(LogLevel.Information, "INFO")]
    [InlineData(LogLevel.Warning, "WARNING")]
    [InlineData(LogLevel.Error, "ERROR")]
    [InlineData(LogLevel.Critical, "CRITICAL")]
    public void EachLevel_HasItsSeverity(LogLevel level, string severity)
    {
        using var line = Parse(Write(level, "mensagem"));

        Assert.Equal(severity, line.RootElement.GetProperty("severity").GetString());
    }

    [Fact]
    public void LevelNone_WritesNothing() => Assert.Equal(string.Empty, Write(LogLevel.None, "mensagem"));

    [Fact]
    public void OneLine_EscapesNewLinesQuotesAndKeepsPortuguese()
    {
        const string message = "Rodada \"Quarta\"\nação é ótima";

        var text = Write(LogLevel.Information, message);

        Assert.Single(text.Split('\n', StringSplitOptions.RemoveEmptyEntries));
        Assert.EndsWith("\n", text, StringComparison.Ordinal);
        Assert.Contains("ação é ótima", text, StringComparison.Ordinal);
        using var line = Parse(text);
        Assert.Equal(message, line.RootElement.GetProperty("message").GetString());
        Assert.Equal(Category, line.RootElement.GetProperty("category").GetString());
        Assert.Equal(FixedTimeProvider.WholeSecondNow().ToString("O", System.Globalization.CultureInfo.InvariantCulture), line.RootElement.GetProperty("time").GetString());
    }

    [Fact]
    public void Exception_HasItsTypeAndStack()
    {
        var exception = new InvalidOperationException("falhou");

        using var line = Parse(Write(LogLevel.Error, "erro", exception));

        var written = line.RootElement.GetProperty("exception");
        Assert.Equal(typeof(InvalidOperationException).FullName, written.GetProperty("type").GetString());
        Assert.Contains("falhou", written.GetProperty("stack").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public void WithoutActivity_WritesNoTrace()
    {
        using var line = Parse(Write(LogLevel.Information, "sem trace"));

        Assert.False(line.RootElement.TryGetProperty(CloudRunJsonFormatter.TraceField, out _));
        Assert.False(line.RootElement.TryGetProperty(CloudRunJsonFormatter.SpanField, out _));
    }

    /// <summary>Case 2, the log side: the trace of the line is the trace id the Sentry tag and the ProblemDetails carry.</summary>
    [Fact]
    public void WithActivity_WritesTheTraceOfTheProject()
    {
        using var activity = new Activity("request").SetIdFormat(ActivityIdFormat.W3C).Start();

        using var line = Parse(Write(LogLevel.Information, "com trace"));

        Assert.Equal($"projects/{ProjectId}/traces/{activity.TraceId.ToHexString()}", line.RootElement.GetProperty(CloudRunJsonFormatter.TraceField).GetString());
        Assert.Equal(activity.SpanId.ToHexString(), line.RootElement.GetProperty(CloudRunJsonFormatter.SpanField).GetString());
    }

    [Fact]
    public void Scopes_AreNeverWritten()
    {
        var scopes = new LoggerExternalScopeProvider();
        using var scope = scopes.Push(new Dictionary<string, object> { ["RequestPath"] = "/r/CODIGOMARCADOR" });

        var text = Write(LogLevel.Information, "com escopo", scopeProvider: scopes);

        Assert.DoesNotContain("CODIGOMARCADOR", text, StringComparison.Ordinal);
        Assert.DoesNotContain("RequestPath", text, StringComparison.Ordinal);
    }

    /// <summary>Case 10: the JSON console only outside Development.</summary>
    [Theory]
    [InlineData("Development", false)]
    [InlineData("Staging", true)]
    [InlineData("Production", true)]
    public async Task Formatter_OnlyOutsideDevelopment(string environment, bool json)
    {
        await using var factory = new SacouApiFactory { Environment = environment };

        var options = factory.Services.GetRequiredService<IOptionsMonitor<ConsoleLoggerOptions>>().CurrentValue;

        Assert.Equal(json, options.FormatterName == CloudRunJsonFormatter.FormatterName);
    }

    private static JsonDocument Parse(string text) => JsonDocument.Parse(text);

    private static string Write(LogLevel level, string message, Exception? exception = null, IExternalScopeProvider? scopeProvider = null)
    {
        var options = new CloudRunJsonFormatterOptions { ProjectId = ProjectId, IncludeScopes = true };
        var formatter = new CloudRunJsonFormatter(new StaticOptionsMonitor(options), new FixedTimeProvider(FixedTimeProvider.WholeSecondNow()));
        var entry = new LogEntry<string>(level, Category, new EventId(1), message, exception, (state, _) => state);
        using var writer = new StringWriter();
        formatter.Write(entry, scopeProvider, writer);
        return writer.ToString();
    }

    private sealed class StaticOptionsMonitor(CloudRunJsonFormatterOptions value) : IOptionsMonitor<CloudRunJsonFormatterOptions>
    {
        public CloudRunJsonFormatterOptions CurrentValue => value;

        public CloudRunJsonFormatterOptions Get(string? name) => value;

        public IDisposable? OnChange(Action<CloudRunJsonFormatterOptions, string?> listener) => null;
    }
}
