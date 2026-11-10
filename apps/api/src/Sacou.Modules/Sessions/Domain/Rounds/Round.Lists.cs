using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>
/// The lists and positions of a round, all calculated from the sequence and never stored, so nobody is
/// renumbered when someone leaves (ADR 0043, D1).
/// </summary>
internal sealed partial record Round
{
    /// <summary>Everyone holding a spot (<c>Going</c> and <c>Promoted</c>), by order of arrival.</summary>
    public ImmutableArray<Attendance> Occupants =>
        [.. Attendances.Where(attendance => attendance.HoldsSpot).OrderBy(attendance => attendance.Sequence)];

    /// <summary>The waitlist, first in line first.</summary>
    public ImmutableArray<Attendance> Waitlist =>
        [.. Attendances.Where(attendance => attendance.IsWaiting).OrderBy(attendance => attendance.Sequence)];

    public int SpotsHeld => Attendances.Count(attendance => attendance.HoldsSpot);

    /// <summary>1-based place in the line of whoever holds a spot or waits; null for "não vou" and for strangers.</summary>
    public int? PositionOf(MemberId member) => AttendanceOf(member) switch
    {
        { HoldsSpot: true } => IndexIn(Occupants, member),
        { IsWaiting: true } => IndexIn(Waitlist, member),
        _ => null,
    };

    /// <summary>The "2º mensalista" of the screens: the place among the mensalistas who hold a spot, by order of arrival.</summary>
    public int? RegularPositionOf(MemberId member)
    {
        var regulars = Occupants.Where(attendance => attendance.Source == AttendanceSource.Regular).ToImmutableArray();
        return IndexIn(regulars, member);
    }

    private static int? IndexIn(ImmutableArray<Attendance> line, MemberId member) =>
        line.Select((attendance, index) => (attendance.Member, Place: index + 1))
            .Where(entry => entry.Member == member)
            .Select(entry => (int?)entry.Place)
            .FirstOrDefault();
}
