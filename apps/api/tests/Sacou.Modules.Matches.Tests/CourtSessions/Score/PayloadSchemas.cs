using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>
/// Port of <c>SCHEMA_BY_TYPE</c> of <c>score.golden.test.ts</c>: written by hand here, apart from the
/// production shapes, so a dropped field fails the coverage check.
/// </summary>
internal sealed record PayloadSchema(string Type, ImmutableArray<string> Fields, ImmutableArray<string> Levels);

internal static class PayloadSchemas
{
    public static readonly ImmutableArray<PayloadSchema> All =
    [
        new(
            "MatchStarted",
            [
                "matchId",
                "rulesVersion",
                "formationsVersion",
                "scoring",
                "scoring.bestOf",
                "scoring.pointsPerSet",
                "scoring.tieBreakPoints",
                "scoring.winMargin",
                "teams",
                "teams.a",
                "teams.a.memberIds",
                "teams.b",
                "teams.b.memberIds",
                "firstServer",
                "rotations",
                "rotations.a",
                "rotations.a.lineup",
                "rotations.a.setterZone",
                "rotations.a.system",
                "rotations.a.bench",
                "rotations.a.libero",
                "rotations.b",
                "rotations.b.lineup",
                "rotations.b.setterZone",
                "rotations.b.system",
                "rotations.b.bench",
                "rotations.b.libero",
                "queue",
                "queue.teams",
                "queue.players",
            ],
            [
                "root",
                "scoring",
                "teams",
                "teams.a",
                "teams.b",
                "rotations",
                "rotations.a",
                "rotations.b",
                "rotations.a.libero",
                "rotations.b.libero",
                "queue",
                "queue.teams",
            ]),
        new("PointScored", ["matchId", "setNumber", "team"], ["root"]),
        new(
            "SetEnded",
            [
                "matchId",
                "setNumber",
                "winner",
                "nextSet",
                "nextSet.targetPoints",
                "nextSet.firstServer",
                "nextSet.setterZones",
                "nextSet.setterZones.a",
                "nextSet.setterZones.b",
            ],
            ["root", "nextSet", "nextSet.setterZones"]),
        new("MatchEnded", ["matchId", "endReason", "winner"], ["root"]),
        new("LineupChanged", ["matchId", "team", "lineup", "setterZone", "bench", "libero"], ["root", "libero"]),
        new("QueueChanged", ["matchId", "queue", "queue.teams", "queue.players"], ["root", "queue", "queue.teams"]),
        new("ServingTeamChanged", ["matchId", "setNumber", "servingTeam", "firstServer"], ["root"]),
        new("PointAttributed", ["matchId", "pointEventId", "kind", "author"], ["root"]),
    ];
}
