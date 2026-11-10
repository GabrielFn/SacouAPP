using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Sessions.Access;

/// <summary>The only way to map a round route: the prefix, the access filter and its marker come together (ADR 0043, D9).</summary>
internal static class RoundRouteExtensions
{
    public const string GroupRoute = "/v1/groups/{" + RoundAccessFilter.GroupIdRouteValue + ":guid}";

    /// <summary>Fits the largest body of the rounds (a layer of 4 KB is the settings ceiling, D10) with room to spare.</summary>
    public const long MaxBodyBytes = 4 * 1024;

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
