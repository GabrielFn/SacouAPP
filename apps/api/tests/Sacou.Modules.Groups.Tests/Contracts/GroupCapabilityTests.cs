using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Tests.Access;
using Xunit;
using DomainRole = Sacou.Modules.Groups.Domain.Members.GroupRole;

namespace Sacou.Modules.Groups.Tests.Contracts;

/// <summary>G6: the contract reads the single permission table, so the two can never disagree.</summary>
public sealed class GroupCapabilityTests
{
    private static readonly StoreGroupMembership Membership = new(new FakeGroupStore());

    [Theory]
    [InlineData(GroupRole.Admin, GroupCapability.ViewGroup, true)]
    [InlineData(GroupRole.Admin, GroupCapability.ManageRounds, true)]
    [InlineData(GroupRole.Admin, GroupCapability.RespondAttendance, true)]
    [InlineData(GroupRole.Admin, GroupCapability.DrawTeams, true)]
    [InlineData(GroupRole.CoAdmin, GroupCapability.ViewGroup, true)]
    [InlineData(GroupRole.CoAdmin, GroupCapability.ManageRounds, true)]
    [InlineData(GroupRole.CoAdmin, GroupCapability.RespondAttendance, true)]
    [InlineData(GroupRole.CoAdmin, GroupCapability.DrawTeams, true)]
    [InlineData(GroupRole.Scorekeeper, GroupCapability.ViewGroup, true)]
    [InlineData(GroupRole.Scorekeeper, GroupCapability.ManageRounds, false)]
    [InlineData(GroupRole.Scorekeeper, GroupCapability.RespondAttendance, true)]
    [InlineData(GroupRole.Scorekeeper, GroupCapability.DrawTeams, false)]
    [InlineData(GroupRole.Player, GroupCapability.ViewGroup, true)]
    [InlineData(GroupRole.Player, GroupCapability.ManageRounds, false)]
    [InlineData(GroupRole.Player, GroupCapability.RespondAttendance, true)]
    [InlineData(GroupRole.Player, GroupCapability.DrawTeams, false)]
    public void Allows_MatchesTheTableWrittenByHand(GroupRole role, GroupCapability capability, bool allowed)
    {
        Assert.Equal(allowed, Membership.Allows(role, capability));
    }

    [Fact]
    public void Allows_AgreesWithRolePermissions_ForEveryCapability()
    {
        foreach (var role in Enum.GetValues<GroupRole>())
        {
            foreach (var capability in Enum.GetValues<GroupCapability>())
            {
                var permission = Enum.Parse<GroupPermission>(capability.ToString());
                Assert.Equal(RolePermissions.Allows(Enum.Parse<DomainRole>(role.ToString()), permission), Membership.Allows(role, capability));
            }
        }
    }
}
