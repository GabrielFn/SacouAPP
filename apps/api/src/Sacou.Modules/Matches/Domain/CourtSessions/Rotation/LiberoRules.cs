using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Rotation;

/// <summary>Port of the libero part of <c>score/rotation-rules.ts</c> and its tables (ADR 0028).</summary>
internal static class LiberoRules
{
    /// <summary>The libero covers one position, or the two of a diagonal, which are this far apart.</summary>
    public const int MinLiberoReplacedIndexes = 1;
    public const int MaxLiberoReplacedIndexes = 2;

    /// <summary>Only these systems play with a libero: the 4x2 and the free system reject it.</summary>
    public static readonly ImmutableArray<FormationSystem> LiberoSystems = [FormationSystem.FiveOne, FormationSystem.SixTwo];

    /// <summary>The indexes of <c>Lineup</c> a setter holds: the libero never covers them (ADR 0026).</summary>
    public static readonly ImmutableDictionary<FormationSystem, ImmutableArray<int>> SetterLineupIndexes =
        ImmutableDictionary.CreateRange<FormationSystem, ImmutableArray<int>>(
        [
            KeyValuePair.Create<FormationSystem, ImmutableArray<int>>(FormationSystem.FiveOne, [0]),
            KeyValuePair.Create<FormationSystem, ImmutableArray<int>>(FormationSystem.SixTwo, [0, 3]),
            KeyValuePair.Create<FormationSystem, ImmutableArray<int>>(FormationSystem.FourTwo, [0, 3]),
            KeyValuePair.Create<FormationSystem, ImmutableArray<int>>(FormationSystem.Livre, []),
        ]);

    /// <summary>The libero only plays in the back row, and never serves from slot 1.</summary>
    public static readonly ImmutableArray<RotationSlot> BackRowSlots = [RotationSlot.One, RotationSlot.Five, RotationSlot.Six];

    public static readonly RotationSlot ServingSlot = RotationSlot.One;

    public static readonly int DiagonalIndexDistance = RotationSlot.All.Length / MaxLiberoReplacedIndexes;

    /// <summary>The indexes of <c>Lineup</c> from slot 1 to slot 6, by the same table that places the members.</summary>
    private static readonly ImmutableArray<int> LineupIndexes = [.. RotationSlot.All.Select((_, index) => index)];

    /// <summary>
    /// The shape of the positions a libero covers, which needs no system: one index or a diagonal, in
    /// ascending order, each one an index of the lineup.
    /// </summary>
    public static bool IsLiberoCoverage(ImmutableArray<int> replacedIndexes)
    {
        if (replacedIndexes.Length is < MinLiberoReplacedIndexes or > MaxLiberoReplacedIndexes
            || !replacedIndexes.All(LineupIndexes.Contains))
        {
            return false;
        }

        return replacedIndexes.Length == MinLiberoReplacedIndexes
            || replacedIndexes[^1] - replacedIndexes[0] == DiagonalIndexDistance;
    }

    /// <summary>Only the 5x1 and the 6x2 have a libero, and the libero never covers a setter (ADR 0028).</summary>
    public static bool IsLiberoAllowed(FormationSystem system, TeamLibero? libero)
    {
        if (libero is null)
        {
            return true;
        }

        var setterIndexes = SetterLineupIndexes[system];
        return LiberoSystems.Contains(system) && !libero.ReplacedIndexes.Any(setterIndexes.Contains);
    }

    /// <summary>
    /// The slot the libero stands in, or <c>null</c> when the libero is out: off, the covered positions
    /// in the front row, or the covered member in slot 1 of a team that serves, because the libero
    /// never serves. A diagonal has one position in each row, so there is one slot at most.
    /// </summary>
    public static RotationSlot? GetLiberoSlot(TeamState teamState, FormationPhase phase)
    {
        if (teamState.Libero is not { } libero)
        {
            return null;
        }

        var indexBySlot = RotationRules.GetLineupBySlot(LineupIndexes, teamState.SetterZone);
        var slot = BackRowSlots.FirstOrDefault(backSlot =>
            libero.ReplacedIndexes.Contains(indexBySlot[RotationSlot.All.IndexOf(backSlot)]));
        return slot is null || (phase == FormationPhase.Serving && slot == ServingSlot) ? null : slot;
    }

    /// <summary>
    /// Who is on the court, from slot 1 to slot 6: the lineup, with the libero in the slot of the member
    /// it covers. <see cref="RotationRules.GetLineupBySlot{T}"/> stays the order of the rotation.
    /// </summary>
    public static ImmutableArray<string> GetOnCourtBySlot(TeamState teamState, FormationPhase phase)
    {
        var lineupBySlot = RotationRules.GetLineupBySlot(teamState.Lineup, teamState.SetterZone);
        if (GetLiberoSlot(teamState, phase) is not { } liberoSlot || teamState.Libero is not { } libero)
        {
            return lineupBySlot;
        }

        return lineupBySlot.SetItem(RotationSlot.All.IndexOf(liberoSlot), libero.MemberId);
    }
}
