using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Domain.Attendances;

/// <summary>Where an attendance came from. <see cref="Regular"/> is the pre-confirmation of a mensalista when the round is made.</summary>
internal enum AttendanceSource
{
    Self,
    Admin,
    Regular,
}

/// <summary>
/// Whether a member goes to one round. <see cref="Going"/> and <see cref="Promoted"/> hold a spot;
/// <see cref="Promoted"/> exists so the app can say "Você entrou da espera" (ADR 0043).
/// </summary>
internal enum AttendanceStatus
{
    Going,
    NotGoing,
    Waitlisted,
    Promoted,
}

/// <summary>
/// One per member per round. <see cref="Sequence"/> orders people, never the clock: it comes from the round's
/// counter, under the round's lock, so two answers in the same millisecond still have an order. The position
/// on the waitlist is calculated from it and never stored.
/// </summary>
internal sealed record Attendance(
    MemberId Member,
    AttendanceStatus Status,
    int Sequence,
    AttendanceSource Source,
    DateTimeOffset RespondedAt,
    DateTimeOffset? PromotedAt)
{
    public bool HoldsSpot => Status is AttendanceStatus.Going or AttendanceStatus.Promoted;

    public bool IsWaiting => Status == AttendanceStatus.Waitlisted;

    /// <summary>Whoever was waiting and got the spot: keeps the sequence, so history stays in order.</summary>
    public Attendance Promote(DateTimeOffset now) =>
        this with { Status = AttendanceStatus.Promoted, PromotedAt = now };

    /// <summary>Gives up or is dropped: no spot, no promotion mark, the sequence stays for the history.</summary>
    public Attendance Decline(AttendanceSource source, DateTimeOffset now) =>
        this with { Status = AttendanceStatus.NotGoing, Source = source, RespondedAt = now, PromotedAt = null };
}
