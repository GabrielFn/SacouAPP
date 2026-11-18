using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Access;

/// <summary>The only way to map a court route: the prefix, the access filter, its marker and the body ceiling come together; Kestrel refuses a larger body with 413 (ADR 0060, D8 step 1).</summary>
internal static class CourtRouteExtensions
{
    public const string GroupRoute = "/v1/groups/{" + CourtAccessFilter.GroupIdRouteValue + ":guid}";

    /// <summary>How the start-up error names a route of this group.</summary>
    private const string RouteKind = "court";

    public static RouteGroupBuilder MapCourtRoutes(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGuardedGroup<CourtAccessFilter, CourtCapabilityMetadata>(GroupRoute, CourtAccessFilterMetadata.Instance, CourtStreamLimits.MaxRequestBytes, RouteKind);

    public static RouteHandlerBuilder RequireCapability(this RouteHandlerBuilder builder, GroupCapability capability) =>
        builder.WithMetadata(new CourtCapabilityMetadata(capability));
}
