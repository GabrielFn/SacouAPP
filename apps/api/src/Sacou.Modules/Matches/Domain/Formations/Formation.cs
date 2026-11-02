using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

/// <summary>The formation of one team in one rotation and phase.</summary>
internal sealed record Formation(
    FormationSystem System,
    RotationKey Rotation,
    FormationPhase Phase,
    ImmutableDictionary<RotationSlot, FormationSlot> Slots,
    PlayerRole? LiberoReplaces,
    string Note);
