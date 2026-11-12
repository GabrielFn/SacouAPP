using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Application;

/// <summary>What a decision under the lock sees: the round as locked, the Groups' view of the group after the lock was won, the caller, and the clock read then.</summary>
internal sealed record RoundWriteContext(Round Round, RoundGroupState Group, GroupMembership? Caller, DateTimeOffset Now);

/// <summary>The change that was written, with the group state it was decided on (to build the answer).</summary>
internal sealed record RoundOutcome(RoundChange Change, RoundGroupState Group)
{
    /// <summary>The round after the change, as the screens read it, for <paramref name="me"/>.</summary>
    public RoundResponse ToResponse(MemberId me) => RoundResponse.From(Change.Round, Group.ResolveStored(Change.Round), Group, me);
}

/// <summary>
/// The one shape of a round write (ADR 0043, D5): the change is decided on the aggregate loaded under the
/// round's lock. Inside the lock the caller's capability is asked of the Groups again, so a demotion between
/// the filter and the lock wins (403), and a member who left meanwhile gets the non-member 404. The Groups are
/// only read, never locked, so the lock order has no cycle.
/// </summary>
internal sealed class RoundWriter(IRoundStore store, GroupRoundContext groups, TimeProvider time, ILogger<RoundWriter> logger)
{
    /// <summary>With <paramref name="required"/> null the write is a repair on a read (D7): nobody's rights are being used.</summary>
    public async Task<Result<RoundOutcome>> ExecuteAsync(
        RoundAccess access,
        RoundId round,
        GroupCapability? required,
        Func<RoundWriteContext, Result<RoundChange>> decide,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        ArgumentNullException.ThrowIfNull(decide);
        RoundOutcome? outcome = null;
        var written = await store.ExecuteInRoundLockAsync(access.GroupId, round, async locked =>
        {
            var decided = await DecideAsync(access, locked, required, decide, cancellationToken).ConfigureAwait(false);
            outcome = decided.IsSuccess ? decided.Value : null;
            return decided.IsSuccess ? Result.Success(decided.Value.Change) : Result.Failure<RoundChange>(decided.Error);
        }, cancellationToken).ConfigureAwait(false);
        RoundLog.LogChange(logger, round, written.Match(_ => "ok", error => error.Code), written.IsSuccess ? written.Value : null);
        return written.IsFailure
            ? Result.Failure<RoundOutcome>(written.Error)
            : Result.Success(outcome ?? throw new InvalidOperationException("A written round always has its outcome."));
    }

    private async Task<Result<RoundOutcome>> DecideAsync(
        RoundAccess access,
        Round locked,
        GroupCapability? required,
        Func<RoundWriteContext, Result<RoundChange>> decide,
        CancellationToken cancellationToken)
    {
        GroupMembership? caller = null;
        if (required is { } capability)
        {
            var checkedCaller = await groups.CallerAsync(access.GroupId, access.UserId, capability, cancellationToken).ConfigureAwait(false);
            if (checkedCaller.IsFailure)
            {
                return Result.Failure<RoundOutcome>(checkedCaller.Error);
            }

            caller = checkedCaller.Value;
        }

        var state = await groups.LoadAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        if (state.IsFailure)
        {
            return Result.Failure<RoundOutcome>(state.Error);
        }

        var decided = decide(new RoundWriteContext(locked, state.Value, caller, time.GetUtcNow()));
        return decided.IsSuccess ? Result.Success(new RoundOutcome(decided.Value, state.Value)) : Result.Failure<RoundOutcome>(decided.Error);
    }
}
