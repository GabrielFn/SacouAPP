using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

/// <summary>A raw catalog entry. The serving phase is derived from it and the base positions.</summary>
internal sealed record FormationTemplate(
    ImmutableDictionary<RotationSlot, ReceivePosition> Receive,
    PlayerRole? LiberoReplaces,
    ImmutableDictionary<RotationSlot, PlayerRole>? ServeSubstitution,
    string Note);
