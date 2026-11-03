using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Rotation;

/// <summary>
/// The libero of a team and the positions it covers, by index of <c>Lineup</c> and never by
/// <c>MemberId</c>: one index, or two on a diagonal in ascending order, never of a setter. Who stands
/// on the court at each moment is derived from the zone and the phase, never recorded (ADR 0028).
/// </summary>
internal sealed record TeamLibero(string MemberId, ImmutableArray<int> ReplacedIndexes);

/// <summary>
/// The part of a team that changes during a match, with the properties in the key order of the
/// events. <c>Lineup</c> has six members anchored on the setter, so a rotation only changes
/// <c>SetterZone</c>, a zone from 1 to 6 (ADR 0024, ADR 0026). <c>Bench</c> is whoever of the team is
/// not in the lineup (ADR 0027), and a <c>null</c> <c>Libero</c> turns it off (ADR 0028).
/// </summary>
internal sealed record TeamState(
    ImmutableArray<string> Bench,
    TeamLibero? Libero,
    ImmutableArray<string> Lineup,
    int SetterZone,
    FormationSystem System);
