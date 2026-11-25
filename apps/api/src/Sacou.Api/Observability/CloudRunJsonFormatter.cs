using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Console;
using Microsoft.Extensions.Options;

namespace Sacou.Api.Observability;

/// <summary>The project the trace field points at (<c>projects/{ProjectId}/traces/...</c>); empty writes no trace.</summary>
internal sealed class CloudRunJsonFormatterOptions : ConsoleFormatterOptions
{
    public string ProjectId { get; set; } = string.Empty;
}

/// <summary>
/// One JSON line per log, in the shape Cloud Logging reads from stdout (ADR 0080, D5): <c>severity</c>,
/// <c>message</c>, the category and the event id, the trace and span of the request, and the exception with its type
/// and stack. Scopes are never written: the hosting scope carries the request path, which holds invite and round codes.
/// </summary>
internal sealed class CloudRunJsonFormatter(IOptionsMonitor<CloudRunJsonFormatterOptions> options, TimeProvider time)
    : ConsoleFormatter(FormatterName)
{
    internal const string FormatterName = "cloud-run-json";
    internal const string TraceField = "logging.googleapis.com/trace";
    internal const string SpanField = "logging.googleapis.com/spanId";

    private static readonly JsonWriterOptions WriterOptions = new()
    {
        // pt-BR text stays readable in the console; JSON escaping still applies to quotes and control characters.
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public override void Write<TState>(in LogEntry<TState> logEntry, IExternalScopeProvider? scopeProvider, TextWriter textWriter)
    {
        ArgumentNullException.ThrowIfNull(textWriter);
        var severity = Severity(logEntry.LogLevel);
        if (severity is null)
        {
            return;
        }

        var message = logEntry.Formatter(logEntry.State, logEntry.Exception);
        using var buffer = new MemoryStream();
        using (var writer = new Utf8JsonWriter(buffer, WriterOptions))
        {
            writer.WriteStartObject();
            writer.WriteString("severity", severity);
            writer.WriteString("time", time.GetUtcNow().ToString("O", CultureInfo.InvariantCulture));
            writer.WriteString("message", message);
            writer.WriteString("category", logEntry.Category);
            writer.WriteNumber("eventId", logEntry.EventId.Id);
            WriteTrace(writer, Activity.Current, options.CurrentValue.ProjectId);
            WriteException(writer, logEntry.Exception);
            writer.WriteEndObject();
        }

        textWriter.Write(Encoding.UTF8.GetString(buffer.ToArray()));
        textWriter.Write('\n');
    }

    /// <summary>The Cloud Logging severity of each level; <see cref="LogLevel.None"/> writes nothing.</summary>
    internal static string? Severity(LogLevel level) => level switch
    {
        LogLevel.Trace or LogLevel.Debug => "DEBUG",
        LogLevel.Information => "INFO",
        LogLevel.Warning => "WARNING",
        LogLevel.Error => "ERROR",
        LogLevel.Critical => "CRITICAL",
        _ => null,
    };

    private static void WriteTrace(Utf8JsonWriter writer, Activity? activity, string projectId)
    {
        if (activity is null)
        {
            return;
        }

        if (projectId.Length > 0)
        {
            writer.WriteString(TraceField, $"projects/{projectId}/traces/{activity.TraceId.ToHexString()}");
        }

        writer.WriteString(SpanField, activity.SpanId.ToHexString());
    }

    private static void WriteException(Utf8JsonWriter writer, Exception? exception)
    {
        if (exception is null)
        {
            return;
        }

        writer.WriteStartObject("exception");
        writer.WriteString("type", exception.GetType().FullName);
        writer.WriteString("stack", exception.ToString());
        writer.WriteEndObject();
    }
}
