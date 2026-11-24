namespace Sacou.Api.Observability;

/// <summary>
/// The request as Sentry may see it (ADR 0080, D4): the template of the matched route (<c>/r/{code}</c>,
/// <c>/v1/groups/{groupId:guid}</c>), never the filled path, which carries invite and round codes.
/// </summary>
internal static class RouteTemplateUrl
{
    internal const string Unmatched = "[unmatched]";

    internal static string For(HttpContext? context)
    {
        var template = (context?.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText;
        if (string.IsNullOrEmpty(template))
        {
            return Unmatched;
        }

        return template.StartsWith('/') ? template : "/" + template;
    }
}
