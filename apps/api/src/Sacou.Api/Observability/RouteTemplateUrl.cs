using Microsoft.AspNetCore.Diagnostics;

namespace Sacou.Api.Observability;

/// <summary>
/// The request as Sentry may see it (ADR 0080, D4): the template of the matched route (<c>/r/{code}</c>,
/// <c>/v1/groups/{groupId:guid}</c>), never the filled path, which carries invite and round codes.
/// </summary>
internal static class RouteTemplateUrl
{
    internal const string Unmatched = "[unmatched]";

    /// <summary>The exception handler clears the endpoint before it logs: its feature still names the failed one.</summary>
    internal static string For(HttpContext? context)
    {
        var endpoint = context?.GetEndpoint() ?? context?.Features.Get<IExceptionHandlerFeature>()?.Endpoint;
        var template = (endpoint as RouteEndpoint)?.RoutePattern.RawText;
        if (string.IsNullOrEmpty(template))
        {
            return Unmatched;
        }

        return template.StartsWith('/') ? template : "/" + template;
    }
}
