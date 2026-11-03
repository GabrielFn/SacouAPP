using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadFields;
using static Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers.PayloadShapeField;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>Port of <c>SCORE_PAYLOAD_SHAPES</c>: the closed schema of each payload, at every level.</summary>
internal static class ScorePayloadShapes
{
    public static readonly PayloadShape Libero = PayloadShape.Of(Leaf(MemberId), Leaf(ReplacedIndexes));

    public static readonly PayloadShape QueueShape = PayloadShape.Of(ListOf(Teams, Leaf(MemberIds)), Leaf(Players));

    public static readonly PayloadShape TeamState = PayloadShape.Of(
        Leaf(Lineup),
        Leaf(SetterZone),
        Leaf(PayloadFields.System),
        Leaf(Bench),
        new PayloadShapeField(PayloadFields.Libero, Libero, null));

    public static readonly PayloadShape MatchStarted = PayloadShape.Of(
        Leaf(MatchId),
        Leaf(RulesVersion),
        Leaf(FormationsVersion),
        Nest(Scoring, Leaf(BestOf), Leaf(PointsPerSet), Leaf(TieBreakPoints), Leaf(WinMargin)),
        Nest(Teams, Nest(SideA, Leaf(MemberIds)), Nest(SideB, Leaf(MemberIds))),
        Leaf(FirstServer),
        Nest(
            Rotations,
            new PayloadShapeField(SideA, TeamState, null),
            new PayloadShapeField(SideB, TeamState, null)),
        new PayloadShapeField(PayloadFields.Queue, QueueShape, null));

    public static readonly PayloadShape PointScored = PayloadShape.Of(Leaf(MatchId), Leaf(SetNumber), Leaf(Team));

    public static readonly PayloadShape SetEnded = PayloadShape.Of(
        Leaf(MatchId),
        Leaf(SetNumber),
        Leaf(Winner),
        Nest(PayloadFields.NextSet, Leaf(TargetPoints), Leaf(FirstServer), Nest(SetterZones, Leaf(SideA), Leaf(SideB))));

    public static readonly PayloadShape MatchEnded = PayloadShape.Of(Leaf(MatchId), Leaf(EndReason), Leaf(Winner));

    public static readonly PayloadShape LineupChanged = PayloadShape.Of(
        Leaf(MatchId),
        Leaf(Team),
        Leaf(Lineup),
        Leaf(SetterZone),
        Leaf(Bench),
        new PayloadShapeField(PayloadFields.Libero, Libero, null));

    public static readonly PayloadShape QueueChanged = PayloadShape.Of(Leaf(MatchId), new PayloadShapeField(PayloadFields.Queue, QueueShape, null));

    public static readonly PayloadShape ServingTeamChanged = PayloadShape.Of(
        Leaf(MatchId),
        Leaf(SetNumber),
        Leaf(ServingTeam),
        Leaf(FirstServer));

    public static readonly PayloadShape PointAttributed = PayloadShape.Of(
        Leaf(MatchId),
        Leaf(PointEventId),
        Leaf(Kind),
        Leaf(Author));
}
