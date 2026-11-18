using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.AppendCourtEvents;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Modules.Sessions.Contracts;

namespace Sacou.Modules.Matches.TakeOverCourt;

/// <summary>
/// A takeover of the court stream (ADR 0063): the body and the round outside any lock; then, under the stream's lock,
/// the role asked again (D4) and <see cref="CourtTakeover.Decide"/>. A canceled round is taken over too, so its points
/// keep an owner (ADR 0060, D7).
/// </summary>
internal sealed class TakeOverCourtHandler(
    IRoundDirectory rounds,
    IGroupMembership membership,
    ICourtStreamStore store,
    TimeProvider time,
    ILogger<TakeOverCourtHandler> logger)
{
    public async Task<Result<TakeOverCourtResponse, CourtProblem>> HandleAsync(
        CourtAccess access, CourtRoute route, ReadOnlyMemory<byte> body, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        ArgumentNullException.ThrowIfNull(route);
        var taken = await TakeOverAsync(access, route, body, cancellationToken).ConfigureAwait(false);
        if (taken.IsSuccess)
        {
            if (taken.Value.OpensBatch)
            {
                CourtLog.TakenOver(logger, route.CourtSessionId, taken.Value.Writer.Batch);
            }

            var decision = taken.Value;
            return Result<TakeOverCourtResponse, CourtProblem>.Success(
                new TakeOverCourtResponse(decision.Writer.Batch, decision.Writer.EventsBefore, decision.LastSequence));
        }

        CourtLog.TakeoverRefused(logger, taken.Error.Error.Code);
        return Result<TakeOverCourtResponse, CourtProblem>.Failure(taken.Error);
    }

    private async Task<Result<CourtTakeoverDecision, CourtProblem>> TakeOverAsync(
        CourtAccess access, CourtRoute route, ReadOnlyMemory<byte> body, CancellationToken cancellationToken)
    {
        var request = TakeoverBodyReader.Read(body);
        if (request.IsFailure)
        {
            return Refuse(CourtProblems.From(request.Error));
        }

        if (await rounds.FindAsync(access.GroupId, route.RoundId, cancellationToken).ConfigureAwait(false) is null)
        {
            return Refuse(CourtProblem.Of(RoundDirectoryErrors.RoundNotFound));
        }

        var call = new CourtTakeoverCall(route.CourtSessionId, access.GroupId, route.RoundId, time.GetUtcNow(), token => StillMayWriteAsync(access, token));
        var callerMemberId = access.MemberId.ToString("D");
        var outcome = await store.TakeOverAsync(call, stored => CourtTakeover.Decide(stored, request.Value, callerMemberId), cancellationToken)
            .ConfigureAwait(false);
        if (outcome.Refusal is { } refusal)
        {
            return Refuse(CourtProblem.Of(CourtErrors.Of(refusal)));
        }

        var decided = outcome.Decided!;
        return decided.IsSuccess
            ? Result<CourtTakeoverDecision, CourtProblem>.Success(decided.Value)
            : Refuse(CourtProblems.From(decided.Error));
    }

    /// <summary>The same member, still active, with a role that still writes the court.</summary>
    private async Task<bool> StillMayWriteAsync(CourtAccess access, CancellationToken cancellationToken)
    {
        var member = await membership.FindActiveAsync(access.GroupId, access.UserId, cancellationToken).ConfigureAwait(false);
        return member is not null && member.MemberId == access.MemberId && membership.Allows(member.Role, GroupCapability.WriteCourt);
    }

    private static Result<CourtTakeoverDecision, CourtProblem> Refuse(CourtProblem problem) =>
        Result<CourtTakeoverDecision, CourtProblem>.Failure(problem);
}
