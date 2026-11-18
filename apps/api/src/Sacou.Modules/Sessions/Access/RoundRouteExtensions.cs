using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Domain;

namespace Sacou.Modules.Sessions.Access;

/// <summary>The only way to map a round route: the prefix, the access filter and its marker come together (ADR 0043, D9).</summary>
internal static class RoundRouteExtensions
{
    public const string GroupRoute = "/v1/groups/{" + RoundAccessFilter.GroupIdRouteValue + ":guid}";

    /// <summary>What a body carries besides the layer: date, time, a venue of up to 4 bytes per character, the flag and the JSON syntax.</summary>
    public const long EnvelopeAllowanceBytes = 1024;

    /// <summary>
    /// A layer at the settings ceiling (D10) plus the rest of the body, so a layer near the ceiling reaches the
    /// Groups' own refusal (400 <c>groups.settings-invalid</c>) instead of a 413.
    /// </summary>
    public const long MaxBodyBytes = SessionLimits.MaxSettingsLayerBytes + EnvelopeAllowanceBytes;

    /// <summary>How the start-up error names a route of this group.</summary>
    private const string RouteKind = "round";

    public static RouteGroupBuilder MapRoundRoutes(this IEndpointRouteBuilder endpoints) =>
        endpoints.MapGuardedGroup<RoundAccessFilter, RoundCapabilityMetadata>(GroupRoute, RoundAccessFilterMetadata.Instance, MaxBodyBytes, RouteKind);

    public static RouteHandlerBuilder RequireCapability(this RouteHandlerBuilder builder, GroupCapability capability) =>
        builder.WithMetadata(new RoundCapabilityMetadata(capability));
}
