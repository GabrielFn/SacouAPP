using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score;

/// <summary>
/// A parsed payload of the score catalog, built only by <see cref="PayloadParsers.ScorePayloadParser"/>.
/// The properties of each record are exactly the keys of its schema, in the key order of the events,
/// and a test enforces it (security review A4, ADR 0033 D12). Only ids, never personal data.
/// </summary>
internal abstract record ScorePayload;

/// <summary><c>Queue</c> is the queue once this match starts: the result of the exit, recorded whole (ADR 0029).</summary>
internal sealed record MatchStartedPayload(
    TeamSide FirstServer,
    long FormationsVersion,
    string MatchId,
    TeamQueue Queue,
    BySide<TeamState?> Rotations,
    long RulesVersion,
    ScoringRules Scoring,
    BySide<TeamRoster> Teams) : ScorePayload;

/// <summary>Records no absolute score and no rotation: the side-out is derived from the state (ADR 0024).</summary>
internal sealed record PointScoredPayload(string MatchId, int SetNumber, TeamSide Team) : ScorePayload;

/// <summary>A <c>null</c> setter zone is a team with the rotation off.</summary>
internal sealed record NextSet(TeamSide FirstServer, BySide<int?> SetterZones, int TargetPoints);

internal sealed record SetEndedPayload(string MatchId, NextSet? NextSet, int SetNumber, TeamSide Winner) : ScorePayload;

internal sealed record MatchEndedPayload(MatchEndReason EndReason, string MatchId, TeamSide? Winner) : ScorePayload;

/// <summary>The whole allocation of the team, never the change, checked against the frozen teams (ADR 0027).</summary>
internal sealed record LineupChangedPayload(
    ImmutableArray<string> Bench,
    TeamLibero? Libero,
    ImmutableArray<string> Lineup,
    string MatchId,
    int SetterZone,
    TeamSide Team) : ScorePayload;

/// <summary>The whole queue, for whoever arrives or leaves during an open match; the last one wins.</summary>
internal sealed record QueueChangedPayload(string MatchId, TeamQueue Queue) : ScorePayload;

/// <summary>A correction of who serves in the open set, recorded whole (ADR 0030).</summary>
internal sealed record ServingTeamChangedPayload(
    TeamSide FirstServer,
    string MatchId,
    TeamSide ServingTeam,
    int SetNumber) : ScorePayload;

/// <summary><c>Author</c> is <c>null</c> only for an error of the opponent (ADR 0031).</summary>
internal sealed record PointAttributedPayload(
    string? Author,
    PointKind Kind,
    string MatchId,
    string PointEventId) : ScorePayload;
