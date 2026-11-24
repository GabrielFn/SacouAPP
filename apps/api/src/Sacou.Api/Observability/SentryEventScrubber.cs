using System.Collections.Frozen;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Sacou.Api.Observability;

/// <summary>
/// What may leave for Sentry (ADR 0080, D4). An allow list, never a deny list: the event is written to its JSON, every
/// field not listed here is dropped, the text that stays goes through <see cref="SensitiveText"/>, and the request keeps
/// only its method and the route template (<c>/r/{code}</c>, never the code). No user, no IP, no server name, no body,
/// no query string, no cookie, no header but the content type.
/// </summary>
internal static class SentryEventScrubber
{
    internal const string TraceIdTag = "trace_id";
    internal const string RouteTag = "route";

    private const string Request = "request";
    private const string Url = "url";
    private const string Headers = "headers";
    private const string Tags = "tags";
    private const string Contexts = "contexts";
    private const string Message = "message";
    private const string Formatted = "formatted";
    private const string Exception = "exception";
    private const string Values = "values";
    private const string Value = "value";
    private const string Mechanism = "mechanism";
    private const string Breadcrumbs = "breadcrumbs";
    private const string Data = "data";

    /// <summary>Top-level fields of the event payload that carry no personal data once their parts are filtered.</summary>
    private static readonly FrozenSet<string> EventFields = FrozenSet.Create(
        StringComparer.Ordinal,
        "event_id", "timestamp", "platform", "level", "logger", "release", "dist", "environment", "sdk", "modules",
        "fingerprint", "transaction", "debug_meta", "threads", Message, "logentry", Exception, Tags, Contexts, Request, Breadcrumbs);

    private static readonly FrozenSet<string> RequestFields = FrozenSet.Create(StringComparer.Ordinal, "method", Url, Headers);

    private static readonly FrozenSet<string> RequestHeaders = FrozenSet.Create(StringComparer.OrdinalIgnoreCase, "Content-Type", "Accept");

    private static readonly FrozenSet<string> TagNames = FrozenSet.Create(StringComparer.Ordinal, TraceIdTag, RouteTag);

    /// <summary>The trace (ids only) and the versions of the runtime and the system: nothing about the person or the machine.</summary>
    private static readonly FrozenSet<string> ContextNames = FrozenSet.Create(StringComparer.Ordinal, "trace", "runtime", "os");

    private static readonly FrozenSet<string> ExceptionFields = FrozenSet.Create(StringComparer.Ordinal, "type", Value, "module", "thread_id", "stacktrace", Mechanism);

    /// <summary>The mechanism without <c>data</c> (the exception's Data dictionary) nor its free-text description.</summary>
    private static readonly FrozenSet<string> MechanismFields = FrozenSet.Create(
        StringComparer.Ordinal, "type", "handled", "synthetic", "terminal", "exception_id", "parent_id", "source", "is_exception_group");

    private static readonly FrozenSet<string> BreadcrumbFields = FrozenSet.Create(StringComparer.Ordinal, "timestamp", Message, "type", Data, "category", "level");

    private static readonly FrozenSet<string> BreadcrumbDataKeys = FrozenSet.Create(StringComparer.Ordinal, Url, "method", "status_code", "eventId");

    /// <summary>The filtered copy of <paramref name="sentryEvent"/>; the original is not changed.</summary>
    internal static SentryEvent Scrub(SentryEvent sentryEvent)
    {
        ArgumentNullException.ThrowIfNull(sentryEvent);
        var json = JsonNode.Parse(Serialize(sentryEvent))!.AsObject();
        var scrubbed = ScrubEvent(json);
        using var document = JsonDocument.Parse(scrubbed.ToJsonString());
        return SentryEvent.FromJson(document.RootElement);
    }

    /// <summary>A new breadcrumb with the message filtered, the URL without its query and only the listed data.</summary>
    internal static Breadcrumb Scrub(Breadcrumb breadcrumb)
    {
        ArgumentNullException.ThrowIfNull(breadcrumb);
        var json = JsonNode.Parse(Serialize(breadcrumb))!.AsObject();
        using var document = JsonDocument.Parse(ScrubBreadcrumb(json).ToJsonString());
        return Breadcrumb.FromJson(document.RootElement);
    }

    /// <summary>The path and nothing after <c>?</c> or <c>#</c>.</summary>
    internal static string WithoutQuery(string url)
    {
        ArgumentNullException.ThrowIfNull(url);
        var end = url.IndexOfAny(['?', '#']);
        return end < 0 ? url : url[..end];
    }

    private static string Serialize(ISentryJsonSerializable payload)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            payload.WriteTo(writer, logger: null);
        }

        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static JsonObject ScrubEvent(JsonObject json)
    {
        var scrubbed = Keep(json, EventFields);
        if (scrubbed[Request] is JsonObject request)
        {
            scrubbed[Request] = ScrubRequest(request, scrubbed[Tags] as JsonObject);
        }

        scrubbed[Tags] = Keep(scrubbed[Tags] as JsonObject, TagNames);
        scrubbed[Contexts] = Keep(scrubbed[Contexts] as JsonObject, ContextNames);
        if (scrubbed[Message] is JsonObject message)
        {
            scrubbed[Message] = new JsonObject { [Formatted] = SensitiveText.Redact(Text(message, Formatted) ?? Text(message, Message)) };
        }

        scrubbed.Remove("logentry");
        if (scrubbed[Exception] is JsonObject exception && exception[Values] is JsonArray values)
        {
            scrubbed[Exception] = new JsonObject { [Values] = new JsonArray([.. values.OfType<JsonObject>().Select(ScrubException)]) };
        }

        if (scrubbed[Breadcrumbs] is JsonArray breadcrumbs)
        {
            scrubbed[Breadcrumbs] = new JsonArray([.. breadcrumbs.OfType<JsonObject>().Select(ScrubBreadcrumb)]);
        }

        return scrubbed;
    }

    /// <summary>The method, the content-type headers and the route template in place of the URL (the path carries codes).</summary>
    private static JsonObject ScrubRequest(JsonObject request, JsonObject? tags)
    {
        var route = tags is null ? null : Text(tags, RouteTag);
        var scrubbed = Keep(request, RequestFields);
        scrubbed[Url] = route ?? RouteTemplateUrl.Unmatched;
        scrubbed[Headers] = Keep(scrubbed[Headers] as JsonObject, RequestHeaders);
        return scrubbed;
    }

    private static JsonObject ScrubException(JsonObject exception)
    {
        var scrubbed = Keep(exception, ExceptionFields);
        scrubbed[Value] = SensitiveText.Redact(Text(scrubbed, Value));
        if (scrubbed[Mechanism] is JsonObject mechanism)
        {
            scrubbed[Mechanism] = Keep(mechanism, MechanismFields);
        }

        return scrubbed;
    }

    private static JsonObject ScrubBreadcrumb(JsonObject breadcrumb)
    {
        var scrubbed = Keep(breadcrumb, BreadcrumbFields);
        scrubbed[Message] = SensitiveText.Redact(Text(scrubbed, Message));
        var data = Keep(scrubbed[Data] as JsonObject, BreadcrumbDataKeys);
        foreach (var key in data.Select(entry => entry.Key).ToList())
        {
            var text = Text(data, key) ?? string.Empty;
            data[key] = key == Url ? WithoutQuery(text) : SensitiveText.Redact(text);
        }

        scrubbed[Data] = data;
        return scrubbed;
    }

    /// <summary>A new object with only the <paramref name="allowed"/> keys, each value copied.</summary>
    private static JsonObject Keep(JsonObject? source, FrozenSet<string> allowed)
    {
        var kept = new JsonObject(new JsonNodeOptions { PropertyNameCaseInsensitive = false });
        if (source is null)
        {
            return kept;
        }

        foreach (var (key, value) in source.Where(entry => allowed.Contains(entry.Key)))
        {
            kept[key] = value?.DeepClone();
        }

        return kept;
    }

    private static string? Text(JsonObject source, string key) =>
        source[key] is JsonValue value && value.TryGetValue<string>(out var text) ? text : null;
}
