using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;

namespace Sacou.Modules.Groups.Tests.Access;

/// <summary>
/// A4 (ADR 0040, D3): every route with a group id has the access filter and exactly one permission; every
/// other route of the API is on a closed list. Like the fallback policy of E3.1, a forgotten line fails.
/// </summary>
internal static class GroupRouteGuard
{
    private const string AnyMethod = "*";

    /// <summary>Routes without a group id, written by hand. A new one means a reviewed change here.</summary>
    public static readonly IReadOnlySet<string> RoutesOutsideTheGroupFilter = new HashSet<string>(StringComparer.Ordinal)
    {
        "* /health",
        "POST /v1/me",
        "GET /v1/me/profile",
        "PUT /v1/me/profile",
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

    private static IEnumerable<string> Violations(RouteEndpoint endpoint, IReadOnlySet<string> outsideTheFilter)
    {
        var route = Describe(endpoint);
        if (endpoint.RoutePattern.GetParameter(GroupAccessFilter.GroupIdRouteValue) is null)
        {
            return outsideTheFilter.Contains(route) ? [] : [$"{route}: outside the group filter and not on the closed list"];
        }

        var permissions = endpoint.Metadata.GetOrderedMetadata<GroupPermissionMetadata>().Count;
        return
        [
            .. endpoint.Metadata.GetMetadata<GroupAccessFilterMetadata>() is null ? [$"{route}: without the group access filter"] : Array.Empty<string>(),
            .. permissions == 1 ? Array.Empty<string>() : [$"{route}: declares {permissions} permissions, not one"],
        ];
    }

    private static string Describe(RouteEndpoint endpoint)
    {
        var methods = endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? [];
        return $"{(methods.Count == 0 ? AnyMethod : string.Join(',', methods))} {endpoint.RoutePattern.RawText}";
    }
}
