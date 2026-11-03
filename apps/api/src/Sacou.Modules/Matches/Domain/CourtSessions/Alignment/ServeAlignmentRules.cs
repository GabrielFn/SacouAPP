using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Alignment;

/// <summary>Port of <c>getServeAlignment</c> in <c>score/serve-alignment.ts</c>, over the C# catalog of E1.5.</summary>
internal static class ServeAlignmentRules
{
    /// <summary>
    /// The formation is chosen by the zone of the lineup, and the members stand where the lineup puts
    /// them; the libero takes the point of the member it covers. Takes the catalog the app has: checking
    /// the version of a recorded match is for the caller.
    /// </summary>
    public static ServeAlignment GetServeAlignment(FormationCatalog catalog, TeamState teamState, FormationPhase phase)
    {
        var zoneFormation = AlignmentTables.ZoneFormations[teamState.System][teamState.SetterZone];
        // The table only has keys of the catalog, and a test holds it to the rotation order.
        var formation = catalog.GetFormation(teamState.System, zoneFormation.FormationKey, phase)
            ?? throw new InvalidOperationException("The zone table names a formation the catalog does not have.");
        var lineupBySlot = RotationRules.GetLineupBySlot(teamState.Lineup, teamState.SetterZone);
        var liberoSlot = LiberoRules.GetLiberoSlot(teamState, phase);

        ImmutableArray<ServeAlignmentSlot> slots =
        [
            .. RotationSlot.All.Select((slot, index) =>
            {
                var point = formation.Slots[slot].Point;
                return teamState.Libero is { } libero && slot == liberoSlot
                    ? new ServeAlignmentSlot(slot, libero.MemberId, AlignmentTables.LiberoRole, point)
                    : new ServeAlignmentSlot(slot, lineupBySlot[index], RoleInTheZone(formation, slot, zoneFormation.SwapPairs), point);
            }),
        ];

        return new ServeAlignment(
            teamState.System,
            teamState.SetterZone,
            zoneFormation.FormationKey,
            phase,
            FindActingSetter(formation, AlignmentTables.ActingSetterRoles[teamState.System], lineupBySlot),
            slots);
    }

    /// <summary>
    /// Where the libero is out, the slot of the libero in the catalog belongs to the member the libero
    /// would replace. Who is out is derived from the zone, never from <c>LiberoReplaces</c> (ADR 0028).
    /// </summary>
    private static PlayerRole RoleWithLiberoOff(Formation formation, RotationSlot slot)
    {
        var role = formation.Slots[slot].Role;
        // The catalog has a libero only in formations that say whom the libero replaces.
        return role == AlignmentTables.LiberoRole ? formation.LiberoReplaces ?? role : role;
    }

    private static PlayerRole RoleInTheZone(Formation formation, RotationSlot slot, bool swapPairs)
    {
        var role = RoleWithLiberoOff(formation, slot);
        return swapPairs ? AlignmentTables.SwappedPairRoles.GetValueOrDefault(role, role) : role;
    }

    /// <summary>A lineup has six members by the parser, and each slot of a formation has one of them.</summary>
    private static string FindActingSetter(Formation formation, PlayerRole actingSetterRole, ImmutableArray<string> lineupBySlot)
    {
        var index = RotationSlot.All.IndexOf(RotationSlot.All.First(slot => formation.Slots[slot].Role == actingSetterRole));
        return lineupBySlot[index];
    }
}
