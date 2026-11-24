using System.Diagnostics;
using Sentry.Extensibility;

namespace Sacou.Api.Observability;

/// <summary>
/// Tags each event with the trace id (the same one of the log line and of the ProblemDetails <c>traceId</c>, ADR 0080,
/// D7) and the route template. Runs on the request's thread, before the scrubber, which keeps only these tags.
/// </summary>
internal sealed class RequestTagsProcessor(IHttpContextAccessor accessor) : ISentryEventProcessor
{
    public SentryEvent? Process(SentryEvent @event)
    {
        ArgumentNullException.ThrowIfNull(@event);
        var activity = Activity.Current;
        if (activity is not null)
        {
            @event.SetTag(SentryEventScrubber.TraceIdTag, activity.TraceId.ToHexString());
        }

        var context = accessor.HttpContext;
        if (context is not null)
        {
            @event.SetTag(SentryEventScrubber.RouteTag, RouteTemplateUrl.For(context));
        }

        return @event;
    }
}
