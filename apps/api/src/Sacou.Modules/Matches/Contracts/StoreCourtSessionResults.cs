using System.Collections.Immutable;
using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Infrastructure;
using DomainMvpKind = Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics.MvpKind;

namespace Sacou.Modules.Matches.Contracts;

/// <summary>
/// The stream heads by an indexed read of <c>court_sessions</c>; the summary from the snapshot of the stream (ADR 0081),
/// built from the stored stream through the same parser as a request. A stored stream that no longer replays was
/// changed outside the API: it fails closed, like a write.
/// </summary>
internal sealed class StoreCourtSessionResults(MatchesDbContext database, ICourtStreamSnapshots snapshots) : ICourtSessionResults
{
    public Task<CourtStreamHead?> FindOfRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken) =>
        database.CourtSessions.AsNoTracking()
            .Where(session => session.GroupId == groupId && session.RoundId == roundId)
            .Select(session => new CourtStreamHead(session.RoundId, session.Id, session.EventCount))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<CourtStreamHead>> ListOfGroupAsync(Guid groupId, CancellationToken cancellationToken) =>
        await database.CourtSessions.AsNoTracking()
            .Where(session => session.GroupId == groupId)
            .OrderBy(session => session.RoundId)
            .Select(session => new CourtStreamHead(session.RoundId, session.Id, session.EventCount))
            .ToListAsync(cancellationToken).ConfigureAwait(false);

    public async Task<CourtSessionResults?> SummarizeAsync(CourtStreamHead stream, SummaryRules rules, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(stream);
        ArgumentNullException.ThrowIfNull(rules);
        var warm = await snapshots.EnsureAsync(stream.CourtSessionId, stream.EventCount, cancellationToken).ConfigureAwait(false);
        if (warm.Snapshot is not { } snapshot)
        {
            return null;
        }

        if (snapshot.Version == 0)
        {
            return new CourtSessionResults(0, SessionSummary.Empty);
        }

        // The head of the snapshot is the replay of the whole stored stream, the same timeline a replay here would give.
        if (snapshot.Head is not { } head)
        {
            throw new CorruptCourtStreamException(stream.CourtSessionId);
        }

        var timeline = new ReplayedTimeline<CourtSessionState>(head.ToEntries());
        return new CourtSessionResults(snapshot.Version, SessionSummaryMapping.ToContract(RoundSummaryRules.GetRoundSummary(timeline, OptionsOf(rules))));
    }

    /// <summary>The modality goes by its catalog code, the one place the codes live (E3.9 part 3, condition 2).</summary>
    internal static RoundSummaryOptions OptionsOf(SummaryRules rules) => new(
        RoundModality.FromCode(GameModalities.CodeOf(rules.Modality))
            ?? throw new InvalidOperationException("Every modality of the catalog has a summary modality."),
        rules.MvpEnabled,
        rules.MvpByStats,
        rules.IndividualPoints);
}

/// <summary>The domain summary as the contract carries it: ids become <see cref="Guid"/>, the codes become enums.</summary>
internal static class SessionSummaryMapping
{
    public static SessionSummary ToContract(RoundSummary summary) => new(
        summary.MvpFormulaVersion,
        [.. summary.FinishedMatches.Select(MatchOf)],
        [.. summary.Players.Select(player => PlayerOf(player, summary.FinishedMatches))],
        new SideHighlightsSummary(
            summary.Sides.MostWins is { } mostWins ? new MostWinsSummary(SideOf(mostWins.Side), mostWins.Wins) : null,
            summary.Sides.LongestStreak is { } streak ? new LongestStreakSummary(SideOf(streak.Side), streak.LongestWinStreak) : null),
        summary.Mvp is { } mvp ? MvpOf(mvp) : null,
        summary.Ranking is { } ranking ? [.. ranking.Select(StandingOf)] : null);

    private static FinishedMatchSummary MatchOf(FinishedMatchResult match) => new(
        Guid.Parse(match.MatchId),
        match.Winner is { } winner ? SideOf(winner) : null,
        Ids(match.Teams.A),
        Ids(match.Teams.B),
        Ids(match.OnCourt.A),
        Ids(match.OnCourt.B),
        match.Points.A,
        match.Points.B);

    private static PlayerSummary PlayerOf(PlayerStats player, ImmutableArray<FinishedMatchResult> finishedMatches) => new(
        Guid.Parse(player.MemberId),
        player.MatchesPlayed,
        player.Wins,
        player.Losses,
        player.Undecided,
        player.PointsFor,
        player.PointsAgainst,
        player.PlusMinus,
        player.LongestWinStreak,
        player.CurrentWinStreak,
        [.. player.Results.Select(OutcomeOf)],
        new PointsByKindSummary(player.PointsByKind.Attack, player.PointsByKind.Block, player.PointsByKind.Ace, player.PointsByKind.Other),
        MvpByStats.MainSideOf(player.MemberId, finishedMatches) is { } side ? SideOf(side) : null);

    private static MvpSummary MvpOf(DayMvp mvp) => new(
        mvp.Kind == DomainMvpKind.Team ? MvpKind.Team : MvpKind.Player,
        Ids(mvp.MemberIds),
        mvp.Side is { } side ? SideOf(side) : null,
        mvp.MatchesPlayed,
        mvp.Wins,
        mvp.PlusMinus,
        mvp.LongestWinStreak);

    private static TeamStandingSummary StandingOf(BeachTeamStanding standing) => new(
        Ids(standing.MemberIds),
        standing.Wins,
        standing.Losses,
        standing.Undecided,
        standing.LongestWinStreak,
        standing.PointsFor,
        standing.PointsAgainst);

    private static MatchOutcome OutcomeOf(MatchResult result) =>
        result == MatchResult.Win ? MatchOutcome.Win : result == MatchResult.Loss ? MatchOutcome.Loss : MatchOutcome.Undecided;

    private static CourtSide SideOf(TeamSide side) => side == TeamSide.A ? CourtSide.A : CourtSide.B;

    private static Guid[] Ids(ImmutableArray<string> ids) => [.. ids.Select(Guid.Parse)];
}
