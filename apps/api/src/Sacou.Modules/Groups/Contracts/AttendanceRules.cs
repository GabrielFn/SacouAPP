namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The attendance leaves of a round, already resolved from the group and the round layer. Plain values, so the
/// Sessions module needs nothing from the Groups domain (ADR 0043). <see cref="RegularsEnabled"/> is a leaf of
/// the group only: a round never overrides it.
/// </summary>
public sealed record AttendanceRules(
    bool Enabled,
    bool CapacityLimited,
    int Capacity,
    bool WaitlistEnabled,
    bool RegularsEnabled,
    bool DropInWindowEnabled,
    int DropInOpensHoursBefore);
