using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Application;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>
/// The avulsos' window holds only while the group has an active mensalista (question 183, option 2; ADR 0079, P3).
/// The members are the active ones the Groups lists, so a mensalista who was removed or left no longer counts.
/// </summary>
public sealed class DropInWindowForGroupTests
{
    private const int WindowHours = 24;

    private static readonly AttendanceRules WithWindow = new(
        Enabled: true, CapacityLimited: true, Capacity: 12, WaitlistEnabled: true, RegularsEnabled: true,
        DropInWindowEnabled: true, DropInOpensHoursBefore: WindowHours);

    private static readonly GroupMembership Regular = new(Guid.NewGuid(), GroupRole.Player, MemberType.Regular);
    private static readonly GroupMembership DropIn = new(Guid.NewGuid(), GroupRole.Admin, MemberType.DropIn);

    [Fact]
    public void OnlyAvulsos_HaveNoActiveRegular()
    {
        Assert.False(RoundGroupState.HasRegular([DropIn]));
        Assert.True(RoundGroupState.HasRegular([DropIn, Regular]));
    }

    [Fact]
    public void RegularRemoved_IsNoLongerActive_SoTheGroupHasNone()
    {
        IReadOnlyList<GroupMembership> before = [DropIn, Regular];
        IReadOnlyList<GroupMembership> afterRemoval = [.. before.Where(member => member != Regular)];

        Assert.True(RoundGroupState.HasRegular(before));
        Assert.False(RoundGroupState.HasRegular(afterRemoval));
    }

    [Fact]
    public void ForGroup_DropsTheWindowWithoutARegular_AndKeepsItWithOne()
    {
        Assert.False(RoundGroupState.ForGroup(WithWindow, hasActiveRegular: false).DropInWindowEnabled);
        Assert.True(RoundGroupState.ForGroup(WithWindow, hasActiveRegular: true).DropInWindowEnabled);
        Assert.Equal(WindowHours, RoundGroupState.ForGroup(WithWindow, hasActiveRegular: false).DropInOpensHoursBefore);
    }
}
