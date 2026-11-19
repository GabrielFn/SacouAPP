using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Modules.Sessions.RoundLinks;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.GetRound;

/// <summary>
/// One round with its lists. The read first makes the next occurrence of the group's series, then looks for
/// something to repair without a lock (a free spot with someone waiting, someone who left the group still
/// listed); only then does it write, under the lock. With nothing to repair a read never writes
/// (ADR 0043, D7).
/// </summary>
internal sealed class GetRoundHandler(
    IRoundStore store,
    RoundMaterializer materializer,
    GroupRoundContext groups,
    RoundWriter writer,
    RoundLinkCodes codes,
    RoundShareLinks links,
    TimeProvider time)
{
    public async Task<Result<RoundResponse>> HandleAsync(RoundAccess access, RoundId id, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        await materializer.EnsureUpcomingAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        var found = await FindAsync(access, id, cancellationToken).ConfigureAwait(false);
        if (found.IsFailure)
        {
            return Result.Failure<RoundResponse>(found.Error);
        }

        var round = found.Value;

        var state = await groups.LoadAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        if (state.IsFailure)
        {
            return Result.Failure<RoundResponse>(state.Error);
        }

        var resolved = state.Value.ResolveStored(round);
        var needsRepair = !RoundReconciliation.Reconcile(round, resolved.Rules, state.Value.ActiveIds, time.GetUtcNow()).IsEmpty;
        return needsRepair
            ? await RepairAsync(access, id, cancellationToken).ConfigureAwait(false)
            : Result.Success(links.Attach(RoundResponse.From(round, resolved, state.Value, access.MemberId), round, access.Role));
    }

    /// <summary>A round made before the link existed gets its code on the first read by someone who may share it (ADR 0070, D1).</summary>
    private async Task<Result<Round>> FindAsync(RoundAccess access, RoundId id, CancellationToken cancellationToken)
    {
        var round = await store.FindAsync(access.GroupId, id, cancellationToken).ConfigureAwait(false);
        if (round is null)
        {
            return Result.Failure<Round>(RoundErrors.RoundNotFound);
        }

        return round.LinkCode is null && links.MayShare(access.Role)
            ? await codes.EnsureAsync(round, cancellationToken).ConfigureAwait(false)
            : Result.Success(round);
    }

    private async Task<Result<RoundResponse>> RepairAsync(RoundAccess access, RoundId id, CancellationToken cancellationToken)
    {
        var repaired = await writer.ExecuteAsync(access, id, required: null, Reconcile, cancellationToken).ConfigureAwait(false);
        return links.Respond(repaired, access);
    }

    private static Result<RoundChange> Reconcile(RoundWriteContext context) =>
        Result.Success(RoundReconciliation.Reconcile(
            context.Round, context.Group.ResolveStored(context.Round).Rules, context.Group.ActiveIds, context.Now));
}
