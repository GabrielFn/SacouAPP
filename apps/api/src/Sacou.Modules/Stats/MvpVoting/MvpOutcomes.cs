using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Modules.Stats.Projections;

namespace Sacou.Modules.Stats.MvpVoting;

/// <summary>
/// The MVP vote of a round as a read sees it: the window, where it stands now, and, once closed, the frozen count
/// (ADR 0072, D12). Null for a round without the vote (off, or cancelled).
/// </summary>
internal sealed record RoundMvpVote(MvpVotingWindow Window, MvpVotingState State, MvpTallyResult? Result);

/// <summary>Where the MVP of a round comes from: the scoreboard (E3.9) or the vote (E3.18).</summary>
internal enum MvpSource
{
    Stats,
    Votes,
}

/// <summary>The MVP of a round after the vote: one member or more (a shared MVP, or the team of the sand by the stats).</summary>
internal sealed record FinalMvp(MvpSource Source, IReadOnlyList<Guid> MemberIds)
{
    public bool Has(Guid memberId) => MemberIds.Contains(memberId);
}

/// <summary>
/// The MVP the summary, the profile and the export show (questions 142 and 143, ADR 0072, D10 and D11): the vote's
/// winners once it closed with a valid vote; else the MVP by the stats, if the group has it on. Before the close, and
/// after a close without a valid vote, it is the stats' one (or none).
/// </summary>
internal static class FinalMvps
{
    public static FinalMvp? Of(RoundProjection round, RoundMvpVote? vote)
    {
        ArgumentNullException.ThrowIfNull(round);
        if (vote?.Result is { Winners.Count: > 0 } result)
        {
            return new FinalMvp(MvpSource.Votes, [.. result.Winners.Select(winner => winner.Value)]);
        }

        return round.Summary.Mvp is { } mvp ? new FinalMvp(MvpSource.Stats, mvp.MemberIds) : null;
    }
}

/// <summary>
/// The vote of the rounds a read shows. A closed vote is counted once, at the first read after its close, with the
/// players and the balance of that moment, and the count is frozen in <c>stats.mvp_results</c>: a correction of the
/// scoreboard after it changes the numbers of the after-game, never the winners nor how many voted (ADR 0072, D12).
/// </summary>
internal sealed class MvpOutcomes(IMvpVoteStore votes, IMvpResultStore results, TimeProvider time)
{
    public async Task<RoundMvpVote?> OfRoundAsync(Guid groupId, RoundProjection round, CancellationToken cancellationToken)
    {
        var found = await OfRoundsAsync(groupId, [round], cancellationToken).ConfigureAwait(false);
        return found.GetValueOrDefault(round.Facts.RoundId);
    }

    /// <summary>The vote of one round already found with its ballot (the result route), frozen once closed.</summary>
    public async Task<RoundMvpVote> OfBallotAsync(Guid groupId, Guid roundId, MvpBallot ballot, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ballot);
        var now = time.GetUtcNow();
        var state = ballot.Window.StateAt(now);
        if (state != MvpVotingState.Closed)
        {
            return new RoundMvpVote(ballot.Window, state, Result: null);
        }

        var frozen = await results.ListForGroupAsync(groupId, cancellationToken).ConfigureAwait(false);
        var result = frozen.GetValueOrDefault(roundId) ?? await FreezeAsync(groupId, roundId, ballot, now, cancellationToken).ConfigureAwait(false);
        return new RoundMvpVote(ballot.Window, state, result);
    }

    /// <summary>The vote of each round of <paramref name="rounds"/> that has one, by round id; reads the stored counts once.</summary>
    public async Task<IReadOnlyDictionary<Guid, RoundMvpVote>> OfRoundsAsync(
        Guid groupId, IReadOnlyList<RoundProjection> rounds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(rounds);
        var now = time.GetUtcNow();
        var voting = rounds
            .Select(round => (round.Facts.RoundId, Found: ProjectedMvpVotingRounds.From(round)))
            .Where(round => round.Found.IsSuccess)
            .Select(round => (round.RoundId, round.Found.Value.Ballot, State: round.Found.Value.Ballot.Window.StateAt(now)))
            .ToList();
        var outcomes = new Dictionary<Guid, RoundMvpVote>(voting.Count);
        if (voting.Count == 0)
        {
            return outcomes;
        }

        var frozen = voting.Any(round => round.State == MvpVotingState.Closed)
            ? await results.ListForGroupAsync(groupId, cancellationToken).ConfigureAwait(false)
            : new Dictionary<Guid, MvpTallyResult>();
        foreach (var (roundId, ballot, state) in voting)
        {
            var result = state != MvpVotingState.Closed ? null
                : frozen.GetValueOrDefault(roundId) ?? await FreezeAsync(groupId, roundId, ballot, now, cancellationToken).ConfigureAwait(false);
            outcomes[roundId] = new RoundMvpVote(ballot.Window, state, result);
        }

        return outcomes;
    }

    private async Task<MvpTallyResult> FreezeAsync(Guid groupId, Guid roundId, MvpBallot ballot, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var cast = await votes.ListForRoundAsync(groupId, roundId, cancellationToken).ConfigureAwait(false);
        var tally = MvpTally.Count(cast, ballot.Players);
        return await results.FreezeAsync(groupId, roundId, tally, now, cancellationToken).ConfigureAwait(false);
    }
}
