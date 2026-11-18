using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.AppendCourtEvents;

namespace Sacou.Modules.Matches.TakeOverCourt;

/// <summary>
/// <c>POST /v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/takeover</c>
/// <c>{ deviceId, expectedBatch, expectedEventCount }</c> (<c>TakeOverCourt</c>): the phone of an admin, co-admin or
/// scorekeeper takes the writing of the stream after confirming the last point and the score it saw (ADR 0063). The
/// old phone is refused from then on. Limited per user by <c>court-sync</c>, like the write (ADR 0062).
/// </summary>
internal static class TakeOverCourtEndpoint
{
    public const string Name = "TakeOverCourt";
    public const string Route = "/rounds/{roundId:guid}/court-sessions/{courtSessionId:guid}/takeover";

    /// <summary>A UUID and two integers fit many times over.</summary>
    public const int MaxBodyBytes = 1024;

    public static RouteGroupBuilder MapTakeOverCourt(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireRateLimiting(RateLimitPolicies.CourtSync)
            .RequireCapability(GroupCapability.WriteCourt)
            .WithMetadata(new RequestSizeLimitAttribute(MaxBodyBytes))
            .WithNoStore()
            .Accepts<TakeOverCourtRequest>("application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status413PayloadTooLarge)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
        return group;
    }

    private static async Task<Results<Ok<TakeOverCourtResponse>, ProblemHttpResult, StatusCodeHttpResult>> HandleAsync(
        Guid roundId, Guid courtSessionId, HttpContext context, TakeOverCourtHandler handler, CancellationToken cancellationToken)
    {
        var body = await BoundedBody.ReadAsync(context.Request, MaxBodyBytes, cancellationToken).ConfigureAwait(false);
        if (body is null)
        {
            return TypedResults.StatusCode(StatusCodes.Status413PayloadTooLarge);
        }

        var taken = await handler.HandleAsync(context.CourtAccess(), new CourtRoute(roundId, courtSessionId), body.Value, cancellationToken)
            .ConfigureAwait(false);
        return taken.IsSuccess
            ? TypedResults.Ok(taken.Value)
            : ProblemResults.From(taken.Error.Error, taken.Error.Extensions);
    }
}
