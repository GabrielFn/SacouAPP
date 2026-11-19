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
/// Where the answer that last changed the row came from: the app, or the round's web page (E3.12, ADR 0070, D3), for
/// the E7.2 metric. Not personal data and never in an event.
/// </summary>
internal enum AttendanceChannel
{
    App,
    Web,
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
    /// <summary>
    /// Changes only with an answer that changes the row, the same rule as <see cref="Sequence"/>: a repeated "vou" keeps it,
    /// and a promotion or a drop by the reconcile keeps it too.
    /// </summary>
    public AttendanceChannel Channel { get; init; } = AttendanceChannel.App;

    public bool HoldsSpot => Status is AttendanceStatus.Going or AttendanceStatus.Promoted;

    public bool IsWaiting => Status == AttendanceStatus.Waitlisted;

    /// <summary>Whoever was waiting and got the spot: keeps the sequence, so history stays in order.</summary>
    public Attendance Promote(DateTimeOffset now) =>
        this with { Status = AttendanceStatus.Promoted, PromotedAt = now };

    /// <summary>Gives up or is dropped: no spot, no promotion mark, the sequence stays for the history. <see cref="Source"/> stays: it is where the row came from (ADR 0043, D6).</summary>
    public Attendance Decline(DateTimeOffset now) =>
        this with { Status = AttendanceStatus.NotGoing, RespondedAt = now, PromotedAt = null };
}
