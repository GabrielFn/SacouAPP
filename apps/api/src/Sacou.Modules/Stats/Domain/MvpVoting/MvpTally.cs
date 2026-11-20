using System.Globalization;
using Sacou.Shared.Members;

namespace Sacou.Modules.Stats.Domain.MvpVoting;

/// <summary>
/// The outcome of a closed vote: the winners (more than one on a full tie, none without a valid vote) and how many
/// voted, the votes a correction dropped included. Never a count per candidate (ADR 0072, D7).
/// </summary>
internal sealed record MvpTallyResult(IReadOnlyList<MemberId> Winners, int Voters);

/// <summary>
/// The count of a vote (ADR 0072, D5 and D6). A vote counts if its candidate still played a finished match in the
/// projection read now (a correction that takes the candidate out drops it); the voter was checked when voting, so a
/// correction that takes the voter out keeps it. Most votes wins; a tie goes to the higher <c>plusMinus</c>, then to
/// more wins; still tied, the MVP is shared, in member id order only for a stable answer.
/// </summary>
internal static class MvpTally
{
    private const string IdFormat = "D";

    public static MvpTallyResult Count(IReadOnlyCollection<MvpVote> votes, IEnumerable<MvpCandidate> players)
    {
        ArgumentNullException.ThrowIfNull(votes);
        var played = players.Where(player => player.MatchesPlayed > 0).ToDictionary(player => player.MemberId);
        var tallies = votes
            .Where(vote => played.ContainsKey(vote.Candidate))
            .GroupBy(vote => vote.Candidate)
            .Select(group => new Tally(played[group.Key], group.Count()))
            .ToList();
        if (tallies.Count == 0)
        {
            return new MvpTallyResult([], votes.Count);
        }

        var best = tallies.Max()!;
        var winners = tallies
            .Where(tally => tally.CompareTo(best) == 0)
            .Select(tally => tally.Candidate.MemberId)
            .OrderBy(member => member.Value.ToString(IdFormat, CultureInfo.InvariantCulture), StringComparer.Ordinal);
        return new MvpTallyResult([.. winners], votes.Count);
    }

    /// <summary>Votes first, then the balance of the scoreboard, then the wins: the order of question 141.</summary>
    private sealed record Tally(MvpCandidate Candidate, int Votes) : IComparable<Tally>
    {
        public int CompareTo(Tally? other)
        {
            if (other is null)
            {
                return 1;
            }

            var byVotes = Votes.CompareTo(other.Votes);
            if (byVotes != 0)
            {
                return byVotes;
            }

            var byBalance = Candidate.PlusMinus.CompareTo(other.Candidate.PlusMinus);
            return byBalance != 0 ? byBalance : Candidate.Wins.CompareTo(other.Candidate.Wins);
        }
    }
}
