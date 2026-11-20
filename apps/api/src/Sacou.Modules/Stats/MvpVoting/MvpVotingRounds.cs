using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Modules.Stats.Projections;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.MvpVoting;

/// <summary>A round with the MVP vote on: its ballot, and the main side of each player for the colour of the screen 12a.</summary>
internal sealed record MvpVotingRound(MvpBallot Ballot, IReadOnlyDictionary<MemberId, CourtSide?> MainSides)
{
    public CourtSide? MainSideOf(MemberId member) => MainSides.GetValueOrDefault(member);
}

/// <summary>The rounds the MVP vote reads, always by <c>(groupId, roundId)</c> and fresh (ADR 0072, D3).</summary>
internal interface IMvpVotingRounds
{
    /// <summary>
    /// The round with its vote, or why not: a round the group does not have, or a cancelled one, is the same 404
    /// <c>sessions.round-not-found</c> as the summary's (D4, E9); a round with <c>mvp.enabled</c> or
    /// <c>mvp.voting</c> off is 404 <c>stats.mvp-voting-off</c>.
    /// </summary>
    Task<Result<MvpVotingRound>> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken);
}

/// <summary>
/// Reads the fresh after-game of the round from the projections of the E3.9 (ADR 0071, L2): the replay runs again when
/// a correction or a late match changed the stream, so who played is always the stream's answer, never a stale row.
/// </summary>
internal sealed class ProjectedMvpVotingRounds(StatsProjector projector) : IMvpVotingRounds
{
    public async Task<Result<MvpVotingRound>> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var projection = await projector.GetRoundAsync(groupId, roundId, cancellationToken).ConfigureAwait(false);
        if (projection is null || projection.Facts.State == RoundState.Canceled)
        {
            return Result.Failure<MvpVotingRound>(RoundDirectoryErrors.RoundNotFound);
        }

        return projection.Facts.Summary.HasMvpVote
            ? Result.Success(ToRound(projection))
            : Result.Failure<MvpVotingRound>(MvpVotingErrors.VotingOff);
    }

    private static MvpVotingRound ToRound(RoundProjection projection)
    {
        var players = projection.Summary.Players;
        var ballot = MvpBallot.Of(
            MvpVotingWindow.From(projection.Facts.EndsAt),
            players.Select(player => new MvpCandidate(new MemberId(player.MemberId), player.MatchesPlayed, player.Wins, player.PlusMinus)));
        return new MvpVotingRound(ballot, players.ToDictionary(player => new MemberId(player.MemberId), player => player.MainSide));
    }
}
