using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;

namespace Sacou.Modules.Groups.Tests.Access;

/// <summary>
/// A4 (ADR 0040, D3; ADR 0043, D9; ADR 0060, D5): every route with a group id has exactly one of the three access filters (the Groups', the
/// Sessions' or the Matches') and exactly one permission or capability; every
/// other route of the API is on a closed list. Like the fallback policy of E3.1, a forgotten line fails.
/// </summary>
internal static class GroupRouteGuard
{
    private const string AnyMethod = "*";

    /// <summary>The Sessions' and the Matches' markers are internal to those modules, so the guard recognizes them by type name.</summary>
    private const string RoundFilterMarker = "RoundAccessFilterMetadata";
    private const string RoundCapabilityMarker = "RoundCapabilityMetadata";
    private const string CourtFilterMarker = "CourtAccessFilterMetadata";
    private const string CourtCapabilityMarker = "CourtCapabilityMetadata";

    /// <summary>Routes without a group id, written by hand. A new one means a reviewed change here.</summary>
    public static readonly IReadOnlySet<string> RoutesOutsideTheGroupFilter = new HashSet<string>(StringComparer.Ordinal)
    {
        "* /health",
        "POST /v1/me",
        "DELETE /v1/me",
        "GET /v1/me/profile",
        "PUT /v1/me/profile",
        "GET /v1/me/export",
        "GET /v1/me/deletion-blockers",
        "POST /v1/groups",
        "GET /v1/groups",
        "POST /v1/invites/preview",
        "POST /v1/invites/accept",
    };

    /// <summary>The OpenAPI document, mapped only in Development (ADR 0042, D2): in Production the list above is all.</summary>
    public static readonly IReadOnlySet<string> DevelopmentOnlyRoutes = new HashSet<string>(StringComparer.Ordinal)
    {
        "GET /openapi/{documentName}.json",
    };

    public static IReadOnlySet<string> RoutesOutsideTheGroupFilterIn(bool development) =>
        development ? RoutesOutsideTheGroupFilter.Union(DevelopmentOnlyRoutes).ToHashSet(StringComparer.Ordinal) : RoutesOutsideTheGroupFilter;

    public static IReadOnlyList<string> Violations(IEnumerable<Endpoint> endpoints, bool development = false) =>
        [.. endpoints.OfType<RouteEndpoint>().SelectMany(endpoint => Violations(endpoint, RoutesOutsideTheGroupFilterIn(development)))];

    private static string[] Violations(RouteEndpoint endpoint, IReadOnlySet<string> outsideTheFilter)
    {
        var route = Describe(endpoint);
        if (endpoint.RoutePattern.GetParameter(GroupAccessFilter.GroupIdRouteValue) is null)
        {
            return outsideTheFilter.Contains(route) ? [] : [$"{route}: outside the group filter and not on the closed list"];
        }

        var groupFilter = endpoint.Metadata.GetMetadata<GroupAccessFilterMetadata>() is not null;
        var roundFilter = HasMarker(endpoint, RoundFilterMarker);
        var courtFilter = HasMarker(endpoint, CourtFilterMarker);
        return (groupFilter, roundFilter, courtFilter) switch
        {
            (false, false, false) => [$"{route}: without the group access filter"],
            (true, false, false) => ExactlyOne(route, endpoint.Metadata.GetOrderedMetadata<GroupPermissionMetadata>().Count, "permissions"),
            (false, true, false) => ExactlyOne(route, CountMarkers(endpoint, RoundCapabilityMarker), "capabilities"),
            (false, false, true) => ExactlyOne(route, CountMarkers(endpoint, CourtCapabilityMarker), "capabilities"),
            _ => [$"{route}: has more than one access filter"],
        };
    }

    private static bool HasMarker(RouteEndpoint endpoint, string marker) => CountMarkers(endpoint, marker) > 0;

    private static int CountMarkers(RouteEndpoint endpoint, string marker) => endpoint.Metadata.Count(item => item.GetType().Name == marker);

    private static string[] ExactlyOne(string route, int declared, string what) =>
        declared == 1 ? [] : [$"{route}: declares {declared} {what}, not one"];

    private static string Describe(RouteEndpoint endpoint)
    {
        var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? [];
        return $"{(methods.Count == 0 ? AnyMethod : string.Join(',', methods))} {endpoint.RoutePattern.RawText}";
    }
}
