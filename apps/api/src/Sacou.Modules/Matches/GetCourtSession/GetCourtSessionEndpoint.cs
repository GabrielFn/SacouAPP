using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.AppendCourtEvents;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Matches.GetCourtSession;

/// <summary>Who writes the current batch, by <c>MemberId</c> only, and since when (server time). Never a device id.</summary>
internal sealed record CourtWriterResponse(Guid MemberId, DateTimeOffset Since);

/// <summary>The stored scoreboard of the open match (ADR 0063, D6): the set shown, and the points and sets of each team.</summary>
internal sealed record CourtScoreboardResponse(Guid MatchId, int SetNumber, int PointsA, int PointsB, int SetsA, int SetsB);

/// <summary>
/// The summary the confirmation shows and the phone that lost the score reads (ADR 0063, D5). <see cref="Scoreboard"/>
/// is null with no open match; <see cref="LastEventAt"/> is the server time of the last stored event.
/// </summary>
internal sealed record GetCourtSessionResponse(
    Guid CourtSessionId,
    long CurrentBatch,
    int EventCount,
    CourtWriterResponse Writer,
    DateTimeOffset? LastEventAt,
    CourtScoreboardResponse? Scoreboard);

/// <summary>
/// <c>GET /v1/groups/{groupId}/rounds/{roundId}/court-session</c> (<c>GetCourtSession</c>): the stream of the round
/// (one per round, question 70), only to whoever may take it over (<c>WriteCourt</c>), with no replay: one row read.
/// No stream in the round is 404 <c>matches.court-session-not-found</c>. <c>no-store</c>; <c>court-sync</c>.
/// </summary>
internal static class GetCourtSessionEndpoint
{
    public const string Name = "GetCourtSession";
    public const string Route = "/rounds/{roundId:guid}/court-session";

    public static RouteGroupBuilder MapGetCourtSession(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireRateLimiting(RateLimitPolicies.CourtSync)
            .RequireCapability(GroupCapability.WriteCourt)
            .WithNoStore();
        return group;
    }

    private static async Task<Results<Ok<GetCourtSessionResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, HttpContext context, IRoundDirectory rounds, ICourtSessionReader reader, CancellationToken cancellationToken)
    {
        var access = context.CourtAccess();
        var found = await FindAsync(access.GroupId, roundId, rounds, reader, cancellationToken).ConfigureAwait(false);
        return found.IsSuccess ? TypedResults.Ok(ToResponse(found.Value)) : ProblemResults.From(found.Error);
    }

    private static async Task<Result<CourtSessionSummary>> FindAsync(
        Guid groupId, Guid roundId, IRoundDirectory rounds, ICourtSessionReader reader, CancellationToken cancellationToken)
    {
        if (await rounds.FindAsync(groupId, roundId, cancellationToken).ConfigureAwait(false) is null)
        {
            return Result.Failure<CourtSessionSummary>(RoundDirectoryErrors.RoundNotFound);
        }

        var summary = await reader.FindSummaryAsync(groupId, roundId, cancellationToken).ConfigureAwait(false);
        return summary is null ? Result.Failure<CourtSessionSummary>(CourtErrors.CourtSessionNotFound) : Result.Success(summary);
    }

    private static GetCourtSessionResponse ToResponse(CourtSessionSummary summary) => new(
        summary.CourtSessionId,
        summary.CurrentBatch,
        summary.EventCount,
        new CourtWriterResponse(summary.WriterMemberId, summary.WriterSince),
        summary.LastEventAt,
        summary.Scoreboard is { } board
            ? new CourtScoreboardResponse(board.MatchId, board.SetNumber, board.PointsA, board.PointsB, board.SetsA, board.SetsB)
            : null);
}
