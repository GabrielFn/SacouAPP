using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score;

/// <summary>An open set. Properties in the key order of the state, as in <c>score/types.ts</c>.</summary>
internal sealed record MatchSet(TeamSide FirstServer, BySide<int> Score, TeamSide ServingTeam, int SetNumber, int TargetPoints);

internal sealed record CompletedMatchSet(BySide<int> Score, int SetNumber, TeamSide Winner);

/// <summary>A match: <c>Teams</c> stays the frozen copy of the event, and <c>Rotations</c> changes.</summary>
internal sealed record MatchScore(
    ImmutableArray<CompletedMatchSet> CompletedSets,
    MatchSet? CurrentSet,
    long FormationsVersion,
    string MatchId,
    BySide<TeamState?> Rotations,
    long RulesVersion,
    ScoringRules Scoring,
    BySide<int> SetsWon,
    BySide<TeamRoster> Teams);

/// <summary>
/// A match that ended; one ended by hand keeps the set in progress in <c>CurrentSet</c>. The writer
/// puts <c>EndReason</c> and <c>Winner</c> in the key order of TypeScript, among the match keys.
/// </summary>
internal sealed record FinishedMatch(MatchScore Match, MatchEndReason EndReason, TeamSide? Winner);

/// <summary><c>Queue</c> is replaced by each event that records it, never accumulated (ADR 0029).</summary>
internal sealed record CourtSessionState(
    MatchScore? CurrentMatch,
    ImmutableArray<FinishedMatch> FinishedMatches,
    TeamQueue Queue)
{
    public static readonly CourtSessionState Initial = new(null, [], TeamQueue.Empty);
}
