using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
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

    public static RouteGroupBuilder MapRoundRoutes(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(GroupRoute);
        group.AddEndpointFilter<RoundAccessFilter>();
        group.WithMetadata(RoundAccessFilterMetadata.Instance, new RequestSizeLimitAttribute(MaxBodyBytes));
        // What the filter itself answers: not registered or no capability (403), not a member (404).
        group.ProducesProblem(StatusCodes.Status403Forbidden).ProducesProblem(StatusCodes.Status404NotFound);
        ((IEndpointConventionBuilder)group).Finally(RequireOneCapability);
        return group;
    }

    public static RouteHandlerBuilder RequireCapability(this RouteHandlerBuilder builder, GroupCapability capability) =>
        builder.WithMetadata(new RoundCapabilityMetadata(capability));

    /// <summary>The API refuses to start with a round route that declares zero or two capabilities, instead of failing on its first call.</summary>
    private static void RequireOneCapability(EndpointBuilder endpoint)
    {
        var declared = endpoint.Metadata.OfType<RoundCapabilityMetadata>().Count();
        if (declared != 1)
        {
            throw new InvalidOperationException($"{endpoint.DisplayName}: a round route declares {declared} capabilities, not one.");
        }
    }
}
