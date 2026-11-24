using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Sessions.Access;

/// <summary>
/// The guard of the routes of screen 07, the draw and the publication of its teams (ADR 0055, ADR 0078): only who draws
/// (<c>DrawTeams</c>), the <c>draw</c> rate limit, and <c>Cache-Control: no-store</c> on every answer, errors included.
/// </summary>
internal static class DrawRouteExtensions
{
    public static RouteHandlerBuilder RequireDrawer(this RouteHandlerBuilder builder) =>
        builder.RequireRateLimiting(RateLimitPolicies.Draw)
            .RequireCapability(GroupCapability.DrawTeams)
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict);
}
