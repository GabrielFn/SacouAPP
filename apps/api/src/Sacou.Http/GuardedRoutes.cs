using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace Sacou.Http;

/// <summary>
/// Maps a route group behind one access filter: the prefix, the filter, its marker, the body ceiling and the
/// filter's own answers come together, and every route of the group declares exactly one capability.
/// </summary>
public static class GuardedRoutes
{
    public static RouteGroupBuilder MapGuardedGroup<TFilter, TCapability>(
        this IEndpointRouteBuilder endpoints,
        string prefix,
        object filterMarker,
        long maxBodyBytes,
        string routeKind)
        where TFilter : class, IEndpointFilter
    {
        var group = endpoints.MapGroup(prefix);
        group.AddEndpointFilter<TFilter>();
        // Kestrel refuses a larger body with 413 before any byte reaches the handler.
        group.WithMetadata(filterMarker, new RequestSizeLimitAttribute(maxBodyBytes));
        // What the filter itself answers: not registered or no capability (403), not a member (404).
        group.ProducesProblem(StatusCodes.Status403Forbidden).ProducesProblem(StatusCodes.Status404NotFound);
        ((IEndpointConventionBuilder)group).Finally(endpoint => RequireOneCapability<TCapability>(endpoint, routeKind));
        return group;
    }

    /// <summary>The API refuses to start with a route that declares zero or two capabilities, instead of failing on its first call.</summary>
    private static void RequireOneCapability<TCapability>(EndpointBuilder endpoint, string routeKind)
    {
        var declared = endpoint.Metadata.OfType<TCapability>().Count();
        if (declared != 1)
        {
            throw new InvalidOperationException($"{endpoint.DisplayName}: a {routeKind} route declares {declared} capabilities, not one.");
        }
    }
}
