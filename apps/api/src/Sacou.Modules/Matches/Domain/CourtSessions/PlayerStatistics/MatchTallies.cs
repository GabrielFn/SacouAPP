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
    /// <summary>
    /// Every active rally of the timeline, in order, the open match too: a reverted point is not on the
    /// timeline. One pass over the entries; the callers share it, so the court of a rally is worked out once.
    /// </summary>
    public static ImmutableArray<PlayedRally> PlayedRallies(ReplayedTimeline<CourtSessionState> timeline)
    {
        var entries = timeline.Entries;
        return [.. entries.SelectMany((entry, index) => index == 0 ? [] : PlayedRallyOf(entries[index - 1], entry))];
    }

    /// <summary>Points for and against each member while on the court, by match, the open one too.</summary>
    public static ImmutableDictionary<string, ImmutableDictionary<string, CourtBalance>> CourtBalancesByMatch(
        ImmutableArray<PlayedRally> rallies) =>
        GroupByMatch(rallies, rally => rally.MatchId)
            .ToImmutableDictionary(group => group.Key, group => BalancesOf(group.Value), StringComparer.Ordinal);

    /// <summary>The rallies of each match, in order, the open one too.</summary>
    public static ImmutableDictionary<string, ImmutableArray<PlayedRally>> RalliesByMatch(ImmutableArray<PlayedRally> rallies) =>
        GroupByMatch(rallies, rally => rally.MatchId);

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

    /// <summary>
    /// Adds up a match, each update replacing the value of its member, the later one winning. The
    /// accumulator is a local mutable builder (E3.9, condition 1 of part 1; no hash-ordered collection, ADR 0033, D10): copying a map per rally made the
    /// TypeScript worst case slow. The updates of an item are read against the map before that item.
    /// </summary>
    private static ImmutableDictionary<string, TValue> Tally<TItem, TValue>(
        ImmutableArray<TItem> items,
        Func<TItem, IReadOnlyDictionary<string, TValue>, IEnumerable<KeyValuePair<string, TValue>>> updatesOf)
    {
        var current = ImmutableDictionary.CreateBuilder<string, TValue>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            foreach (var update in updatesOf(item, current).ToList())
            {
                current[update.Key] = update.Value;
            }
        }

        return current.ToImmutableDictionary();
    }

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

    /// <summary>
    /// The balance of each member over the rallies of one match. The hot loop of the worst case (E3.9, part 1,
    /// condition 1): the counts live in local arrays, indexed by the order a member first stood on the court,
    /// so a rally only reads the index map. A member is in one team of a match only (the parser refuses a
    /// repeated one), so a rally credits each member once.
    /// </summary>
    private static ImmutableDictionary<string, CourtBalance> BalancesOf(ImmutableArray<PlayedRally> rallies)
    {
        var indexes = ImmutableDictionary.CreateBuilder<string, int>(StringComparer.Ordinal);
        var pointsFor = new List<int>();
        var pointsAgainst = new List<int>();
        foreach (var rally in rallies)
        {
            foreach (var side in TeamSide.All)
            {
                var counts = side == rally.Team ? pointsFor : pointsAgainst;
                foreach (var memberId in rally.OnCourt.Of(side))
                {
                    if (!indexes.TryGetValue(memberId, out var index))
                    {
                        index = pointsFor.Count;
                        indexes.Add(memberId, index);
                        pointsFor.Add(0);
                        pointsAgainst.Add(0);
                    }

                    counts[index]++;
                }
            }
        }

        return indexes.ToImmutableDictionary(entry => entry.Key, entry => new CourtBalance(pointsFor[entry.Value], pointsAgainst[entry.Value]), StringComparer.Ordinal);
    }

    private static IEnumerable<KeyValuePair<string, PointsByKind>> CreditAuthor(
        PointAttribution attribution,
        IReadOnlyDictionary<string, PointsByKind> points)
    {
        if (attribution.Author is not { } author || !PointsByKind.CreditedPointKinds.Contains(attribution.Kind))
        {
            return [];
        }

        return [KeyValuePair.Create(author, points.GetValueOrDefault(author, PointsByKind.None).Credit(attribution.Kind))];
    }

}

/// <summary>Who stood on each side of the court in a rally, and the side that won it.</summary>
internal sealed record PlayedRally(string MatchId, TeamSide Team, BySide<ImmutableArray<string>> OnCourt);
