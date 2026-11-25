using System.Globalization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Shared.Results;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>
/// <c>POST /v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/events</c> <c>{ events }</c>
/// (<c>AppendCourtEvents</c>): the phone that holds the court sends its events, idempotent by event id (ADR 0060). The
/// first write creates the stream with batch 1, written by that device and member. Admin, co-admin and scorekeeper.
/// Each call continues the snapshot of the stream (ADR 0081) and is limited per user by <c>court-sync</c> (ADR 0062);
/// a snapshot that cannot be built now is a 503 <c>matches.court-busy</c> with <c>Retry-After</c>.
/// </summary>
internal static class AppendCourtEventsEndpoint
{
    public const string Name = "AppendCourtEvents";
    public const string Route = "/rounds/{roundId:guid}/court-sessions/{courtSessionId:guid}/events";

    public static RouteGroupBuilder MapAppendCourtEvents(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireRateLimiting(RateLimitPolicies.CourtSync)
            .RequireCapability(GroupCapability.WriteCourt)
            .Accepts<AppendCourtEventsRequest>("application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status413PayloadTooLarge)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
        return group;
    }

    private static async Task<Results<Ok<AppendCourtEventsResponse>, ProblemHttpResult, StatusCodeHttpResult>> HandleAsync(
        Guid roundId, Guid courtSessionId, HttpContext context, AppendCourtEventsHandler handler, CancellationToken cancellationToken)
    {
        var body = await BoundedBody.ReadAsync(context.Request, CourtStreamLimits.MaxRequestBytes, cancellationToken).ConfigureAwait(false);
        if (body is null)
        {
            return TypedResults.StatusCode(StatusCodes.Status413PayloadTooLarge);
        }

        var written = await handler.HandleAsync(context.CourtAccess(), new CourtRoute(roundId, courtSessionId), body.Value, cancellationToken)
            .ConfigureAwait(false);
        if (written.IsSuccess)
        {
            return TypedResults.Ok(written.Value);
        }

        if (written.Error.Error.Kind == ErrorKind.Unavailable)
        {
            context.Response.Headers.RetryAfter = CourtErrors.BusyRetryAfterSeconds.ToString(CultureInfo.InvariantCulture);
        }

        return ProblemResults.From(written.Error.Error, written.Error.Extensions);
    }
}
