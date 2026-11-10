using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Xunit;
using R = Sacou.Modules.Groups.Tests.Domain.Role;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>D5 to D7: the last admin, removing and leaving, and mensalista × avulso. Each refusal has its control.</summary>
public sealed class MemberRulesTests
{
    private static readonly DateTimeOffset Later = GroupBuilder.Now.AddHours(1);

    /// <summary>D6, written by hand: who removes whom (the target is someone else).</summary>
    public static readonly TheoryData<R, R, bool> RemoveRows = new()
    {
        { R.Admin, R.Admin, true },
        { R.Admin, R.CoAdmin, true },
        { R.Admin, R.Scorekeeper, true },
        { R.Admin, R.Player, true },
        { R.CoAdmin, R.Admin, false },
        { R.CoAdmin, R.CoAdmin, false },
        { R.CoAdmin, R.Scorekeeper, true },
        { R.CoAdmin, R.Player, true },
        { R.Scorekeeper, R.Admin, false },
        { R.Scorekeeper, R.CoAdmin, false },
        { R.Scorekeeper, R.Scorekeeper, false },
        { R.Scorekeeper, R.Player, false },
        { R.Player, R.Admin, false },
        { R.Player, R.CoAdmin, false },
        { R.Player, R.Scorekeeper, false },
        { R.Player, R.Player, false },
    };

    [Fact]
    public void LastAdmin_IsNeitherDemotedNorLeaves()
    {
        var world = GroupBuilder.WithFounder();
        world.Add(R.CoAdmin.ToDomain());

        Assert.Equal(GroupErrors.LastAdmin, world.Group.ChangeRole(world.Founder.Id, world.Founder.Id, R.CoAdmin.ToDomain(), GroupBuilder.Now).Error);
        Assert.Equal(GroupErrors.LastAdmin, world.Group.ChangeRole(world.Founder.Id, world.Founder.Id, R.Player.ToDomain(), GroupBuilder.Now).Error);
        Assert.Equal(GroupErrors.LastAdmin, world.Group.Leave(world.Founder.Id, Later).Error);
    }

    [Fact]
    public void WithTwoAdmins_EitherOneDemotesOrLeaves()
    {
        var world = GroupBuilder.WithFounder();
        var second = world.Add(R.Admin.ToDomain());

        Assert.True(world.Group.ChangeRole(world.Founder.Id, world.Founder.Id, R.Player.ToDomain(), GroupBuilder.Now).IsSuccess);
        Assert.True(world.Group.ChangeRole(world.Founder.Id, second.Id, R.CoAdmin.ToDomain(), GroupBuilder.Now).IsSuccess);
        Assert.True(world.Group.Leave(world.Founder.Id, Later).IsSuccess);
        Assert.True(world.Group.Leave(second.Id, Later).IsSuccess);
    }

    /// <summary>An admin who left or was removed does not count, and neither does a co-admin.</summary>
    [Theory]
    [InlineData(Status.Left)]
    [InlineData(Status.Removed)]
    public void InactiveAdmin_DoesNotCount(Status status)
    {
        var world = GroupBuilder.WithFounder();
        world.Add(R.Admin.ToDomain(), status.ToDomain());

        Assert.Equal(GroupErrors.LastAdmin, world.Group.Leave(world.Founder.Id, Later).Error);
    }

    [Fact]
    public void AfterTheDemotionOfOneAdmin_TheOtherIsTheLast()
    {
        var world = GroupBuilder.WithFounder();
        var second = world.Add(R.Admin.ToDomain());
        var demoted = world.Group.ChangeRole(world.Founder.Id, second.Id, R.Player.ToDomain(), GroupBuilder.Now).Value.Group;

        Assert.Equal(GroupErrors.LastAdmin, demoted.Leave(world.Founder.Id, Later).Error);
    }

    [Theory]
    [MemberData(nameof(RemoveRows))]
    public void Remove_FollowsTheTable(R actorRole, R targetRole, bool allowed)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(actorRole.ToDomain());
        var target = world.Add(targetRole.ToDomain());

        var result = world.Group.Remove(actor.Id, target.Id, Later);

        if (allowed)
        {
            var removed = Assert.Single(result.Value.ChangedMembers);
            Assert.Equal(target with { Status = MembershipStatus.Removed, LeftAt = Later }, removed);
            Assert.DoesNotContain(result.Value.Group.ActiveMembers, member => member.Id == target.Id);
        }
        else
        {
            Assert.Equal(GroupErrors.Forbidden, result.Error);
        }
    }

    [Fact]
    public void RemoveRows_CoverEveryActorAndTarget() =>
        Assert.Equal(Enum.GetValues<GroupRole>().Length * Enum.GetValues<GroupRole>().Length, RemoveRows.Select(row => (row.Data.Item1, row.Data.Item2)).Distinct().Count());

    [Theory]
    [InlineData(R.Admin)]
    [InlineData(R.CoAdmin)]
    public void RemovingOneself_IsUseLeave(R role)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(role.ToDomain());

        Assert.Equal(GroupErrors.UseLeave, world.Group.Remove(actor.Id, actor.Id, Later).Error);
        Assert.True(world.Group.Leave(actor.Id, Later).IsSuccess);
    }

    [Theory]
    [InlineData(Status.Left)]
    [InlineData(Status.Removed)]
    public void RemovingSomeoneInactive_IsNotFound(Status status)
    {
        var world = GroupBuilder.WithFounder();
        var target = world.Add(R.Player.ToDomain(), status.ToDomain());

        Assert.Equal(GroupErrors.MemberNotFound, world.Group.Remove(world.Founder.Id, target.Id, Later).Error);
    }

    [Theory]
    [InlineData(R.CoAdmin)]
    [InlineData(R.Scorekeeper)]
    [InlineData(R.Player)]
    public void Leave_MarksTheMemberAsLeftAndKeepsTheRow(R role)
    {
        var world = GroupBuilder.WithFounder();
        var member = world.Add(role.ToDomain());

        var result = world.Group.Leave(member.Id, Later);

        Assert.Equal(member with { Status = MembershipStatus.Left, LeftAt = Later }, Assert.Single(result.Value.ChangedMembers));
        Assert.Equal(world.Group.Members.Length, result.Value.Group.Members.Length);
    }

    [Fact]
    public void LeaveTwice_IsTheGroupNotFound()
    {
        var world = GroupBuilder.WithFounder();
        var member = world.Add(R.Player.ToDomain(), MembershipStatus.Left);

        Assert.Equal(GroupErrors.GroupNotFound, world.Group.Leave(member.Id, Later).Error);
    }

    [Theory]
    [InlineData(R.Admin, true)]
    [InlineData(R.CoAdmin, true)]
    [InlineData(R.Scorekeeper, false)]
    [InlineData(R.Player, false)]
    public void ChangeMemberType_IsForAdminsAndCoAdmins(R actorRole, bool allowed)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(actorRole.ToDomain());
        var target = world.Add(R.Player.ToDomain());

        var result = world.Group.ChangeMemberType(actor.Id, target.Id, MemberType.Regular);

        if (allowed)
        {
            Assert.Equal(target with { Type = MemberType.Regular }, Assert.Single(result.Value.ChangedMembers));
        }
        else
        {
            Assert.Equal(GroupErrors.Forbidden, result.Error);
        }
    }

    [Fact]
    public void ChangeMemberType_ToTheSameType_ChangesNothing()
    {
        var world = GroupBuilder.WithFounder();
        var target = world.Add(R.Player.ToDomain());

        Assert.True(world.Group.ChangeMemberType(world.Founder.Id, target.Id, MemberType.DropIn).Value.IsEmpty);
    }

    /// <summary>D7: a guest without an account is always a drop-in (E3.5 creates them; the rule is already here).</summary>
    [Fact]
    public void GuestWithoutAccount_NeverBecomesRegular()
    {
        var world = GroupBuilder.WithFounder();
        var guest = world.Add(R.Player.ToDomain(), hasAccount: false);
        var person = world.Add(R.Player.ToDomain());

        Assert.Equal(GroupErrors.RegularNeedsAccount, world.Group.ChangeMemberType(world.Founder.Id, guest.Id, MemberType.Regular).Error);
        Assert.True(world.Group.ChangeMemberType(world.Founder.Id, person.Id, MemberType.Regular).IsSuccess);
    }

    [Fact]
    public void ChangeMemberType_OfSomeoneInactive_IsNotFound()
    {
        var world = GroupBuilder.WithFounder();
        var target = world.Add(R.Player.ToDomain(), MembershipStatus.Removed);

        Assert.Equal(GroupErrors.MemberNotFound, world.Group.ChangeMemberType(world.Founder.Id, target.Id, MemberType.Regular).Error);
    }

    /// <summary>The aggregate never changes in place: the old value is still the old group.</summary>
    [Fact]
    public void Changes_ReturnANewGroup()
    {
        var world = GroupBuilder.WithFounder();
        var target = world.Add(R.Player.ToDomain());
        var before = world.Group;

        var after = before.ChangeRole(world.Founder.Id, target.Id, R.Scorekeeper.ToDomain(), GroupBuilder.Now).Value.Group;

        Assert.Equal(R.Player.ToDomain(), before.Members.Single(member => member.Id == target.Id).Role);
        Assert.NotEqual(before, after);
    }
}
