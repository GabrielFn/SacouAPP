using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Alignment;

internal sealed record ServeAlignmentSlot(RotationSlot Slot, string MemberId, PlayerRole Role, CourtPoint Point);

/// <summary>
/// Where a team stands at the moment of the serve. <c>Slots</c> go from slot 1 to slot 6. Only the
/// slot the libero is in has the role <c>L</c>; with the libero off, or out of the court, none has.
/// </summary>
internal sealed record ServeAlignment(
    FormationSystem System,
    int SetterZone,
    RotationKey FormationKey,
    FormationPhase Phase,
    string ActingSetter,
    ImmutableArray<ServeAlignmentSlot> Slots);
