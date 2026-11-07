using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Attributions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;

/// <summary>
/// Port of <c>stats/by-match.ts</c>, <c>stats/rally-balance.ts</c>, <c>stats/points-by-kind.ts</c> and
/// <c>score/on-court.ts</c>: what each match gave each member, from the timeline alone (ADR 0032).
/// </summary>
internal static class MatchTallies
{
    /// <summary>Points for and against each member while on the court, by match, the open one too.</summary>
    public static ImmutableDictionary<string, ImmutableDictionary<string, CourtBalance>> CourtBalancesByMatch(
        ReplayedTimeline<CourtSessionState> timeline)
    {
        var entries = timeline.Entries;
        ImmutableArray<PlayedRally> rallies =
        [
            .. entries.SelectMany((entry, index) => index == 0 ? [] : PlayedRallyOf(entries[index - 1], entry)),
        ];
        return GroupByMatch(rallies, rally => rally.MatchId)
            .ToImmutableDictionary(group => group.Key, group => Tally<PlayedRally, CourtBalance>(group.Value, CreditsOf), StringComparer.Ordinal);
    }

    /// <summary>
    /// The points each member scored, by kind and by match, the open one too. Only a resolved
    /// attribution counts, the last valid one of each active point (ADR 0031).
    /// </summary>
    public static ImmutableDictionary<string, ImmutableDictionary<string, PointsByKind>> PointsByMatch(
        ReplayedTimeline<CourtSessionState> timeline)
    {
        var attributions = PointAttributionResolver.Resolve(timeline);
        return GroupByMatch(attributions, attribution => attribution.MatchId)
            .ToImmutableDictionary(group => group.Key, group => Tally<PointAttribution, PointsByKind>(group.Value, CreditAuthor), StringComparer.Ordinal);
    }

    /// <summary>
    /// Who of a team stood on the court in a rally, from the match right before the point: the libero
    /// included when the projection puts it in, the bench never. With the rotation off, anyone of the team.
    /// </summary>
    public static ImmutableArray<string> OnCourtInTheRally(MatchScore match, TeamSide servingTeam, TeamSide team) =>
        match.Rotations.Of(team) is { } teamState
            ? LiberoRules.GetOnCourtBySlot(teamState, servingTeam == team ? FormationPhase.Serving : FormationPhase.Receiving)
            : match.Teams.Of(team).MemberIds;

    /// <summary>
    /// Splits items in timeline order by match. The items of a match are contiguous, because one match
    /// is open at a time and a match id is unique; a later run of the same id replaces an earlier one,
    /// as the TypeScript <c>Map</c> does.
    /// </summary>
    private static ImmutableDictionary<string, ImmutableArray<T>> GroupByMatch<T>(ImmutableArray<T> items, Func<T, string> matchIdOf)
    {
        var runs = ImmutableDictionary.Create<string, ImmutableArray<T>>(StringComparer.Ordinal);
        var start = 0;
        for (var index = 1; index <= items.Length; index++)
        {
            if (index == items.Length || !string.Equals(matchIdOf(items[index]), matchIdOf(items[start]), StringComparison.Ordinal))
            {
                runs = runs.SetItem(matchIdOf(items[start]), items[start..index]);
                start = index;
            }
        }

        return runs;
    }

    /// <summary>Adds up a match, each update replacing the value of its member, the later one winning.</summary>
    private static ImmutableDictionary<string, TValue> Tally<TItem, TValue>(
        ImmutableArray<TItem> items,
        Func<TItem, ImmutableDictionary<string, TValue>, IEnumerable<KeyValuePair<string, TValue>>> updatesOf) =>
        items.Aggregate(
            ImmutableDictionary.Create<string, TValue>(StringComparer.Ordinal),
            (current, item) => updatesOf(item, current).Aggregate(current, (next, update) => next.SetItem(update.Key, update.Value)));

    /// <summary>The rally of an active point, from the state right before it: the court and the serve of that moment.</summary>
    private static IEnumerable<PlayedRally> PlayedRallyOf(TimelineEntry<CourtSessionState> before, TimelineEntry<CourtSessionState> entry)
    {
        var match = before.State.CurrentMatch;
        if (PointScoredParser.ReadStored(entry.Event) is not { } point
            || match?.CurrentSet is not { } set
            || !string.Equals(match.MatchId, point.MatchId, StringComparison.Ordinal))
        {
            return [];
        }

        return
        [
            new PlayedRally(
                match.MatchId,
                point.Team,
                new BySide<ImmutableArray<string>>(
                    OnCourtInTheRally(match, set.ServingTeam, TeamSide.A),
                    OnCourtInTheRally(match, set.ServingTeam, TeamSide.B))),
        ];
    }

    private static IEnumerable<KeyValuePair<string, CourtBalance>> CreditsOf(
        PlayedRally rally,
        ImmutableDictionary<string, CourtBalance> balances) =>
        TeamSide.All.SelectMany(side => rally.OnCourt.Of(side).Select(memberId =>
            KeyValuePair.Create(memberId, Credit(balances.GetValueOrDefault(memberId, CourtBalance.None), side == rally.Team))));

    private static CourtBalance Credit(CourtBalance balance, bool won)
    {
        const int OnePoint = 1;
        return won
            ? balance with { PointsFor = balance.PointsFor + OnePoint }
            : balance with { PointsAgainst = balance.PointsAgainst + OnePoint };
    }

    private static IEnumerable<KeyValuePair<string, PointsByKind>> CreditAuthor(
        PointAttribution attribution,
        ImmutableDictionary<string, PointsByKind> points)
    {
        if (attribution.Author is not { } author || !PointsByKind.CreditedPointKinds.Contains(attribution.Kind))
        {
            return [];
        }

        return [KeyValuePair.Create(author, points.GetValueOrDefault(author, PointsByKind.None).Credit(attribution.Kind))];
    }

    /// <summary>Who stood on each side of the court in a rally, and the side that won it.</summary>
    private sealed record PlayedRally(string MatchId, TeamSide Team, BySide<ImmutableArray<string>> OnCourt);
}
