using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Stats.Access;

/// <summary>The only way to map a stats route under a group: the prefix, the access filter, its marker and the body ceiling come together.</summary>
internal static class StatsRouteExtensions
{
    public const string GroupRoute = "/v1/groups/{" + StatsAccessFilter.GroupIdRouteValue + ":guid}";

    /// <summary>The stats routes are reads: no body is expected, so Kestrel refuses any but a tiny one with 413.</summary>
    public const long MaxRequestBytes = 1024;

    /// <summary>How the start-up error names a route of this group.</summary>
    private const string RouteKind = "stats";

    public static RouteGroupBuilder MapStatsRoutes(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGuardedGroup<StatsAccessFilter, StatsCapabilityMetadata>(GroupRoute, StatsAccessFilterMetadata.Instance, MaxRequestBytes, RouteKind);

    public static RouteHandlerBuilder RequireCapability(this RouteHandlerBuilder builder, GroupCapability capability) =>
        builder.WithMetadata(new StatsCapabilityMetadata(capability));
}
