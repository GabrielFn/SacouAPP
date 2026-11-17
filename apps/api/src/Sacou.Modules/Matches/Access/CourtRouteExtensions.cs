using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Access;

/// <summary>The only way to map a court route: the prefix, the access filter, its marker and the body ceiling come together.</summary>
internal static class CourtRouteExtensions
{
    public const string GroupRoute = "/v1/groups/{" + CourtAccessFilter.GroupIdRouteValue + ":guid}";

    public static RouteGroupBuilder MapCourtRoutes(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup(GroupRoute);
        group.AddEndpointFilter<CourtAccessFilter>();
        // Kestrel refuses a larger body with 413 before any byte reaches the reader (ADR 0060, D8 step 1).
        group.WithMetadata(CourtAccessFilterMetadata.Instance, new RequestSizeLimitAttribute(CourtStreamLimits.MaxRequestBytes));
        // What the filter itself answers: not registered or no capability (403), not a member (404).
        group.ProducesProblem(StatusCodes.Status403Forbidden).ProducesProblem(StatusCodes.Status404NotFound);
        ((IEndpointConventionBuilder)group).Finally(RequireOneCapability);
        return group;
    }

    public static RouteHandlerBuilder RequireCapability(this RouteHandlerBuilder builder, GroupCapability capability) =>
        builder.WithMetadata(new CourtCapabilityMetadata(capability));

    /// <summary>The API refuses to start with a court route that declares zero or two capabilities, instead of failing on its first call.</summary>
    private static void RequireOneCapability(EndpointBuilder endpoint)
    {
        var declared = endpoint.Metadata.OfType<CourtCapabilityMetadata>().Count();
        if (declared != 1)
        {
            throw new InvalidOperationException($"{endpoint.DisplayName}: a court route declares {declared} capabilities, not one.");
        }
    }
}
