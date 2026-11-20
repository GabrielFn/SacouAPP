using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Modules.Stats.Projections;

namespace Sacou.Modules.Stats.GetMyStats;

/// <summary>The sums of one member in a season, or of the person over all their groups (rule 3.7). Integers only.</summary>
internal sealed record SeasonTotals(
    int MatchesPlayed, int Wins, int Losses, int PlusMinus, int LongestWinStreak, int MvpCount, int Rounds, int RoundsHeld)
{
    public static readonly SeasonTotals None = new(0, 0, 0, 0, 0, 0, 0, 0);
}

/// <summary>
/// One membership of the person with the fresh rounds of its group, earliest first, and the MVP vote of the rounds
/// that have one, by round id (ADR 0072, D11): a round missing from <see cref="MvpVotes"/> has no vote.
/// </summary>
internal sealed record MembershipRounds(
    UserMembership Membership, IReadOnlyList<RoundProjection> Rounds, IReadOnlyDictionary<Guid, RoundMvpVote> MvpVotes)
{
    /// <summary>The MVP of the round after its vote has <paramref name="memberId"/>: a shared MVP counts for each winner.</summary>
    public bool WasMvp(RoundProjection round, Guid memberId)
    {
        ArgumentNullException.ThrowIfNull(round);
        return FinalMvps.Of(round, MvpVotes.GetValueOrDefault(round.Facts.RoundId))?.Has(memberId) == true;
    }
}

/// <summary>
/// The card and the profile (screens 14 and 15, rule 3.7 of ADR 0071), a pure function of the fresh projections:
/// only rounds that count (scheduled, with a stream) of the season, the civil year of the round's local date in
/// <c>America/Sao_Paulo</c>. The longest streak runs across rounds, concatenating the results in play order.
/// Presence (question 99, option 1, L5): <see cref="SeasonTotals.Rounds"/> the member played over
/// <see cref="SeasonTotals.RoundsHeld"/>, the rounds of the group with a finished match while the member was in it.
/// </summary>
internal static class PlayerTotals
{
    public static SeasonTotals Of(MembershipRounds membership, int year)
    {
        ArgumentNullException.ThrowIfNull(membership);
        return Sum(membership, Played(membership, year), Held(membership, year));
    }

    /// <summary>The person over every group: the sums added, and the streak over all their rounds in play order.</summary>
    public static SeasonTotals OfPerson(IReadOnlyList<MembershipRounds> memberships, int year)
    {
        ArgumentNullException.ThrowIfNull(memberships);
        var groups = memberships.Select(membership => Of(membership, year)).ToList();
        var results = memberships
            .SelectMany(membership => Played(membership, year).Select(round => (Round: round, membership.Membership.MemberId)))
            .OrderBy(played => played.Round.Facts.StartsAt.UtcTicks)
            .ThenBy(played => played.Round.Facts.RoundId.ToString("D"), StringComparer.Ordinal)
            .SelectMany(played => ResultsOf(played.Round, played.MemberId));
        return new SeasonTotals(
            groups.Sum(total => total.MatchesPlayed),
            groups.Sum(total => total.Wins),
            groups.Sum(total => total.Losses),
            groups.Sum(total => total.PlusMinus),
            LongestStreak(results),
            groups.Sum(total => total.MvpCount),
            groups.Sum(total => total.Rounds),
            groups.Sum(total => total.RoundsHeld));
    }

    private static SeasonTotals Sum(MembershipRounds membership, List<RoundProjection> played, int held)
    {
        var memberId = membership.Membership.MemberId;
        var players = played.Select(round => round.Summary.Players.First(player => player.MemberId == memberId)).ToList();
        return new SeasonTotals(
            players.Sum(player => player.MatchesPlayed),
            players.Sum(player => player.Wins),
            players.Sum(player => player.Losses),
            players.Sum(player => player.PlusMinus),
            LongestStreak(played.SelectMany(round => ResultsOf(round, memberId))),
            played.Count(round => membership.WasMvp(round, memberId)),
            played.Count,
            held);
    }

    /// <summary>The counted rounds of the season the member played a finished match in, in play order.</summary>
    private static List<RoundProjection> Played(MembershipRounds membership, int year) =>
        [.. InSeason(membership.Rounds, year).Where(round => PlayedIn(round, membership.Membership.MemberId))];

    /// <summary>
    /// The counted rounds of the season with a finished match while the member was in the group (from joining to
    /// leaving), and every round they played: so <see cref="SeasonTotals.Rounds"/> never passes it.
    /// </summary>
    private static int Held(MembershipRounds membership, int year)
    {
        var member = membership.Membership;
        return InSeason(membership.Rounds, year).Count(round => round.Summary.FinishedMatches.Count > 0
            && (PlayedIn(round, member.MemberId) || WhileIn(round.Facts.StartsAt, member)));
    }

    private static bool WhileIn(DateTimeOffset startsAt, UserMembership member) =>
        startsAt >= member.JoinedAt && (member.LeftAt is not { } left || startsAt <= left);

    private static IEnumerable<RoundProjection> InSeason(IEnumerable<RoundProjection> rounds, int year) =>
        rounds.Where(round => round.Counts && round.Facts.LocalDate.Year == year);

    private static bool PlayedIn(RoundProjection round, Guid memberId) =>
        round.Summary.Players.Any(player => player.MemberId == memberId && player.MatchesPlayed > 0);

    private static IEnumerable<MatchOutcome> ResultsOf(RoundProjection round, Guid memberId) =>
        round.Summary.Players.FirstOrDefault(player => player.MemberId == memberId)?.Results ?? [];

    /// <summary>A match without a winner breaks the streak, as within a round (rule 9 of the statistics).</summary>
    private static int LongestStreak(IEnumerable<MatchOutcome> results)
    {
        var (longest, current) = (0, 0);
        foreach (var result in results)
        {
            current = result == MatchOutcome.Win ? current + 1 : 0;
            longest = Math.Max(longest, current);
        }

        return longest;
    }
}
