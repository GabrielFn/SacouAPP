using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

internal sealed record FormationCatalog(
    ImmutableDictionary<RotationSlot, CourtPoint> BasePositions,
    ImmutableDictionary<FormationSystem, FormationSystemTemplate> Systems)
{
    /// <summary>Returns <c>null</c> when the system does not use that rotation.</summary>
    public Formation? GetFormation(FormationSystem system, RotationKey rotation, FormationPhase phase)
    {
        if (!Systems[system].Rotations.TryGetValue(rotation, out var template))
        {
            return null;
        }

        var slots = phase == FormationPhase.Receiving ? ReceivingSlots(template) : ServingSlots(template);
        return new Formation(system, rotation, phase, slots, template.LiberoReplaces, template.Note);
    }

    private static ImmutableDictionary<RotationSlot, FormationSlot> ReceivingSlots(FormationTemplate template) =>
        BuildSlots(slot => new FormationSlot(template.Receive[slot].Role, template.Receive[slot].Point));

    private ImmutableDictionary<RotationSlot, FormationSlot> ServingSlots(FormationTemplate template) =>
        BuildSlots(slot => new FormationSlot(ServingRole(template, slot), BasePositions[slot]));

    private static PlayerRole ServingRole(FormationTemplate template, RotationSlot slot) =>
        template.ServeSubstitution?.GetValueOrDefault(slot) ?? template.Receive[slot].Role;

    private static ImmutableDictionary<RotationSlot, FormationSlot> BuildSlots(Func<RotationSlot, FormationSlot> readSlot) =>
        RotationSlot.All.ToImmutableDictionary(slot => slot, readSlot);
}
