using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>The attendance leaves of a resolved document, by their catalog path.</summary>
internal static class AttendanceRulesReader
{
    public static AttendanceRules From(GroupSettings resolved) => new(
        Enabled: resolved.ValueOf("attendance.enabled").Boolean,
        CapacityLimited: resolved.ValueOf("attendance.capacityLimited").Boolean,
        Capacity: (int)resolved.ValueOf("attendance.capacity").Number,
        WaitlistEnabled: resolved.ValueOf("attendance.waitlistEnabled").Boolean,
        RegularsEnabled: resolved.ValueOf("attendance.regularsEnabled").Boolean,
        DropInWindowEnabled: resolved.ValueOf("attendance.dropInWindowEnabled").Boolean,
        DropInOpensHoursBefore: (int)resolved.ValueOf("attendance.dropInOpensHoursBefore").Number);
}
