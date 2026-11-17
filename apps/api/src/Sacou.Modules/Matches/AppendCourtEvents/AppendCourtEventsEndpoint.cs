using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>
/// <c>POST /v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/events</c> <c>{ events }</c>
/// (<c>AppendCourtEvents</c>): the phone that holds the court sends its events, idempotent by event id (ADR 0060). The
/// first write creates the stream with batch 1, written by that device and member. Admin, co-admin and scorekeeper.
/// </summary>
internal static class AppendCourtEventsEndpoint
{
    public const string Name = "AppendCourtEvents";
    public const string Route = "/rounds/{roundId:guid}/court-sessions/{courtSessionId:guid}/events";

    public static RouteGroupBuilder MapAppendCourtEvents(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name)
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
        return written.IsSuccess
            ? TypedResults.Ok(written.Value)
            : ProblemResults.From(written.Error.Error, written.Error.Extensions);
    }
}
