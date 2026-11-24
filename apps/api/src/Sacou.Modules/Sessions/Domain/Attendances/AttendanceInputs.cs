using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Domain.Attendances;

/// <summary>What the member answers.</summary>
internal enum AttendanceResponse
{
    Going,
    NotGoing,
}

/// <summary>Who is answering: the member for themselves, or an admin for them (ADR 0043, D1).</summary>
internal enum ResponseActor
{
    Self,
    Admin,
}

/// <summary>Mensalista or avulso, read from the Groups at the moment of the answer and never copied into the attendance.</summary>
internal enum MemberKind
{
    Regular,
    DropIn,
}

internal readonly record struct Respondent(MemberId Id, MemberKind Kind);

/// <summary>
/// The attendance leaves of the round, resolved by the Groups (<c>AttendanceRules</c> of the contract), as
/// plain values so this domain needs nothing from the Groups. The name differs from the contract's on purpose:
/// <see cref="AttendanceRules"/> here is the reducer.
/// </summary>
internal sealed record AttendanceSettings(
    bool Enabled,
    bool CapacityLimited,
    int Capacity,
    bool WaitlistEnabled,
    bool RegularsEnabled,
    bool DropInWindowEnabled,
    int DropInOpensHoursBefore)
{
    /// <summary>Without a limit there is always room. Lowering the capacity never takes anyone out, it only closes the room.</summary>
    public bool HasRoom(int spotsHeld) => !CapacityLimited || spotsHeld < Capacity;

    /// <summary>How many more people fit; unbounded without a limit.</summary>
    public int FreeSpots(int spotsHeld) => CapacityLimited ? Math.Max(0, Capacity - spotsHeld) : int.MaxValue;

    /// <summary>
    /// The rules as they hold for the group right now. Without an active mensalista every member is an avulso, so the
    /// avulsos' window would keep everyone out until it opens: it does not hold (question 183, option 2; ADR 0079, P3).
    /// It holds again as soon as the group has a mensalista, since the members are read at every answer and every read.
    /// </summary>
    public AttendanceSettings ForGroup(bool hasActiveRegular) =>
        hasActiveRegular || !DropInWindowEnabled ? this : this with { DropInWindowEnabled = false };
}
