using Sacou.Modules.Groups.Domain;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>The way in by a round link (E3.12, ADR 0070, D2): the invite's person rules, without an invite.</summary>
public sealed class JoinAsDropInTests
{
    private static readonly DateTimeOffset Later = GroupBuilder.Now.AddDays(1);

    [Fact]
    public void NewPerson_JoinsAsPlayerAndDropIn()
    {
        var world = GroupBuilder.WithFounder();
        var person = new UserId(Guid.NewGuid());

        var change = world.Group.JoinAsDropIn(person, personActiveGroups: 0, Later).Value;

        var joined = Assert.Single(change.ChangedMembers);
        Assert.Equal((person, GroupRole.Player, MemberType.DropIn, MembershipStatus.Active, Later), (joined.UserId!.Value, joined.Role, joined.Type, joined.Status, joined.JoinedAt));
        Assert.Empty(change.ChangedInvites);
        Assert.Same(joined, change.Group.ActiveMemberOf(person));
    }

    [Fact]
    public void ActiveRegular_IsUnchanged_KeepingRoleAndType()
    {
        var world = GroupBuilder.WithFounder();
        var regular = world.Add(GroupRole.CoAdmin) with { Type = MemberType.Regular };
        world.Replace(regular);

        var change = world.Group.JoinAsDropIn(regular.UserId!.Value, personActiveGroups: 1, Later).Value;

        Assert.True(change.IsEmpty);
        Assert.Equal(regular, change.Group.ActiveMemberOf(regular.UserId!.Value));
    }

    [Fact]
    public void LeftMember_ComesBackWithTheSameId_AsPlayerAndDropIn()
    {
        var world = GroupBuilder.WithFounder();
        var left = world.Add(GroupRole.Admin, MembershipStatus.Left) with { Type = MemberType.Regular };
        world.Replace(left);

        var back = Assert.Single(world.Group.JoinAsDropIn(left.UserId!.Value, 0, Later).Value.ChangedMembers);

        Assert.Equal((left.Id, GroupRole.Player, MemberType.DropIn, MembershipStatus.Active, Later), (back.Id, back.Role, back.Type, back.Status, back.JoinedAt));
    }

    [Fact]
    public void RemovedMember_IsRefused()
    {
        var world = GroupBuilder.WithFounder();
        var removed = world.Add(GroupRole.Player, MembershipStatus.Removed);

        Assert.Equal(GroupErrors.MemberRemoved, world.Group.JoinAsDropIn(removed.UserId!.Value, 0, Later).Error);
    }

    [Fact]
    public void Ceilings_AreTheInvites()
    {
        var world = GroupBuilder.WithFounder();
        var person = new UserId(Guid.NewGuid());
        Assert.Equal(GroupErrors.MembershipLimit, world.Group.JoinAsDropIn(person, GroupLimits.MaxActiveGroupsPerPerson, Later).Error);

        for (var member = 1; member < GroupLimits.MaxActiveMembersPerGroup; member++)
        {
            world.Add(GroupRole.Player);
        }

        Assert.Equal(GroupErrors.MemberLimit, world.Group.JoinAsDropIn(person, 0, Later).Error);
    }
}
