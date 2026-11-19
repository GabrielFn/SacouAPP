using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// The two routes of the round link, the only Sessions routes without a group id (ADR 0070, D3): the code is the
/// capability, so they sit in the closed list of the route guard (ADR 0040, D4) instead of the round routes.
/// </summary>
internal static class RoundLinkRoutes
{
    public const string Prefix = "/v1/round-links";

    /// <summary>A code and an answer: a few dozen bytes; anything near this ceiling is not a real request.</summary>
    public const long MaxBodyBytes = 1024;

    /// <summary>A round link route: its own name, the shared window, the small body, no cache, and the refusals every one has.</summary>
    public static RouteHandlerBuilder MapRoundLinkPost(this IEndpointRouteBuilder endpoints, string route, Delegate handler, string name) =>
        endpoints.MapPost(route, handler).WithName(name)
            .RequireRateLimiting(RateLimitPolicies.RoundLink)
            .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes))
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status403Forbidden)
            .ProducesProblem(StatusCodes.Status404NotFound);
}
