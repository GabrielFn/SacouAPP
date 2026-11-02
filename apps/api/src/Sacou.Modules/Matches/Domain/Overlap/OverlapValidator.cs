using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.Overlap;

internal static class OverlapValidator
{
    /// <summary>A fraction of the half court: 0.02 of its 9 m is about 18 cm.</summary>
    public const double DefaultTolerance = 0.02;

    /// <summary>The ServingPlayer is the one in this slot, and stays out of the classic serving check.</summary>
    private static readonly RotationSlot ServingSlot = RotationSlot.One;

    private static readonly ImmutableArray<OverlapRelation> WithoutServingPlayer =
        [.. OverlapRelation.All.Where(relation => !relation.Involves(ServingSlot))];

    /// <param name="positions">Where each player stands.</param>
    /// <param name="mode">Always required: the validator applies no default mode.</param>
    /// <param name="phase">Which relations are in force, together with the mode.</param>
    /// <param name="tolerance">Reaches depth and lateral relations alike. <c>null</c> is the default; <c>0</c> is zero.</param>
    public static OverlapResult Validate(
        CourtPositions positions,
        OverlapRuleMode mode,
        FormationPhase phase,
        double? tolerance = null)
    {
        var effectiveTolerance = tolerance ?? DefaultTolerance;
        if (!IsValidTolerance(effectiveTolerance))
        {
            return new OverlapResult.InvalidTolerance();
        }

        var relations = RelationsInForce(mode, phase);
        ImmutableArray<OverlapRelation> violations =
            [.. relations.Where(relation => !relation.Holds(positions, effectiveTolerance))];
        return violations.IsEmpty ? new OverlapResult.Passed(relations) : new OverlapResult.Violated(violations);
    }

    /// <summary>Takes the phase from the formation and ignores roles: the libero counts in the place taken.</summary>
    public static OverlapResult ValidateFormation(Formation formation, OverlapRuleMode mode, double? tolerance = null)
    {
        var positions = new CourtPositions(formation.Slots.ToImmutableDictionary(pair => pair.Key, pair => pair.Value.Point));
        return Validate(positions, mode, formation.Phase, tolerance);
    }

    private static bool IsValidTolerance(double tolerance) => double.IsFinite(tolerance) && tolerance >= 0;

    private static ImmutableArray<OverlapRelation> RelationsInForce(OverlapRuleMode mode, FormationPhase phase)
    {
        if (phase == FormationPhase.Receiving)
        {
            return OverlapRelation.All;
        }

        return mode == OverlapRuleMode.Fivb2025To28 ? [] : WithoutServingPlayer;
    }
}
