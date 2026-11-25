using Sacou.Modules.Groups.Domain.Members;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>
/// Question 231 of E6.3: a deletion reapplied to a restored backup takes the only admin anyway, and the oldest active
/// member with an account (earliest joined, then lowest member id) becomes Admin. A guest never does.
/// </summary>
public sealed class EraseAccountAfterRestoreTests
{
    private static readonly DateTimeOffset Later = GroupBuilder.Now.AddDays(3);

    [Fact]
    public void OnlyAdmin_Goes_AndTheEarliestJoinedWithAnAccountBecomesAdmin()
    {
        var world = GroupBuilder.WithFounder();
        var newer = Joined(world, GroupRole.Player, hoursAfterFounder: 5);
        var oldest = Joined(world, GroupRole.Scorekeeper, hoursAfterFounder: 2);
        var founder = world.Founder;

        var change = world.Group.EraseAccountAfterRestore(founder.UserId!.Value, Later);

        Assert.Null(change.Group.Members.Single(member => member.Id == founder.Id).UserId);
        var admin = Assert.Single(change.Group.ActiveMembers, member => member.IsActiveAdmin);
        Assert.Equal(oldest.Id, admin.Id);
        Assert.Equal(oldest with { Role = GroupRole.Admin }, admin);
        Assert.Equal(GroupRole.Player, change.Group.Members.Single(member => member.Id == newer.Id).Role);
        Assert.Contains(admin, change.ChangedMembers);
        Assert.Equal(2, change.ChangedMembers.Length);
    }

    [Fact]
    public void SameJoiningInstant_TheLowestMemberIdWins()
    {
        var world = GroupBuilder.WithFounder();
        var first = Joined(world, GroupRole.Player, hoursAfterFounder: 1, id: Guid.Parse("00000000-0000-7000-8000-000000000002"));
        var lower = Joined(world, GroupRole.Player, hoursAfterFounder: 1, id: Guid.Parse("00000000-0000-7000-8000-000000000001"));

        var change = world.Group.EraseAccountAfterRestore(world.Founder.UserId!.Value, Later);

        Assert.Equal(lower.Id, Assert.Single(change.Group.ActiveMembers, member => member.IsActiveAdmin).Id);
        Assert.NotEqual(GroupRole.Admin, change.Group.Members.Single(member => member.Id == first.Id).Role);
    }

    /// <summary>The co-admin is not an admin, so the group has none left, and is a member with an account who can take it.</summary>
    [Fact]
    public void CoAdmin_IsPromoted_WhenTheOldest()
    {
        var world = GroupBuilder.WithFounder();
        var coAdmin = Joined(world, GroupRole.CoAdmin, hoursAfterFounder: 1);
        _ = Joined(world, GroupRole.Player, hoursAfterFounder: 2);

        var change = world.Group.EraseAccountAfterRestore(world.Founder.UserId!.Value, Later);

        Assert.Equal(coAdmin.Id, Assert.Single(change.Group.ActiveMembers, member => member.IsActiveAdmin).Id);
    }

    [Fact]
    public void GuestsAndFormerMembers_AreNeverPromoted_SoTheGroupStaysWithoutAdmin()
    {
        var world = GroupBuilder.WithFounder();
        world.Add(GroupRole.Player, hasAccount: false);
        world.Add(GroupRole.Player, MembershipStatus.Left);
        var founder = world.Founder;

        Assert.True(world.Group.LosesLastAdminWith(founder.UserId!.Value));
        var change = world.Group.EraseAccountAfterRestore(founder.UserId!.Value, Later);

        Assert.DoesNotContain(change.Group.Members, member => member.Role == GroupRole.Admin && member.IsActive);
        Assert.Equal(founder.Id, Assert.Single(change.ChangedMembers).Id);
    }

    /// <summary>An older guest and an older former member are skipped: the oldest one who is active and has an account wins.</summary>
    [Fact]
    public void OlderGuestAndOlderFormerMember_AreSkipped_ForTheNewerPlayerWithAnAccount()
    {
        var world = GroupBuilder.WithFounder();
        var guest = world.Add(GroupRole.Player, hasAccount: false);
        var former = world.Add(GroupRole.Player, MembershipStatus.Left);
        var player = Joined(world, GroupRole.Player, hoursAfterFounder: 9);
        var earlier = GroupBuilder.Now.AddHours(1);
        world.Replace(world.Group with
        {
            Members = world.Group.Members
                .Replace(world.Group.Members.Single(member => member.Id == guest.Id), guest with { JoinedAt = earlier })
                .Replace(world.Group.Members.Single(member => member.Id == former.Id), former with { JoinedAt = earlier }),
        });

        var change = world.Group.EraseAccountAfterRestore(world.Founder.UserId!.Value, Later);

        Assert.Equal(player.Id, Assert.Single(change.Group.ActiveMembers, member => member.IsActiveAdmin).Id);
        Assert.NotEqual(GroupRole.Admin, change.Group.Members.Single(member => member.Id == guest.Id).Role);
        Assert.NotEqual(GroupRole.Admin, change.Group.Members.Single(member => member.Id == former.Id).Role);
    }

    [Fact]
    public void AnotherActiveAdmin_NoOneIsPromoted()
    {
        var world = GroupBuilder.WithFounder();
        var otherAdmin = world.Add(GroupRole.Admin);
        world.Add(GroupRole.Player);

        Assert.False(world.Group.LosesLastAdminWith(world.Founder.UserId!.Value));
        var change = world.Group.EraseAccountAfterRestore(world.Founder.UserId!.Value, Later);

        Assert.Equal(otherAdmin.Id, Assert.Single(change.Group.ActiveMembers, member => member.IsActiveAdmin).Id);
        Assert.Single(change.ChangedMembers);
    }

    [Fact]
    public void PersonWhoIsNotTheAdmin_IsErased_WithoutAPromotion()
    {
        var world = GroupBuilder.WithFounder();
        var player = world.Add(GroupRole.Player);
        world.Add(GroupRole.Player);

        Assert.False(world.Group.LosesLastAdminWith(player.UserId!.Value));
        var change = world.Group.EraseAccountAfterRestore(player.UserId!.Value, Later);

        Assert.Equal(world.Founder.Id, Assert.Single(change.Group.ActiveMembers, member => member.IsActiveAdmin).Id);
        Assert.Equal(player.Id, Assert.Single(change.ChangedMembers).Id);
    }

    /// <summary>An admin who already left is no admin of the group: erasing them promotes no one.</summary>
    [Fact]
    public void FormerAdmin_IsErased_WithoutAPromotion()
    {
        var world = GroupBuilder.WithFounder();
        var formerAdmin = world.Add(GroupRole.Admin, MembershipStatus.Left);

        Assert.False(world.Group.LosesLastAdminWith(formerAdmin.UserId!.Value));
        var change = world.Group.EraseAccountAfterRestore(formerAdmin.UserId!.Value, Later);

        Assert.Equal(formerAdmin.Id, Assert.Single(change.ChangedMembers).Id);
    }

    private static GroupMember Joined(GroupBuilder world, GroupRole role, int hoursAfterFounder, Guid? id = null)
    {
        var added = world.Add(role);
        var member = added with
        {
            Id = id is { } own ? new MemberId(own) : added.Id,
            JoinedAt = GroupBuilder.Now.AddHours(hoursAfterFounder),
        };
        world.Replace(world.Group with { Members = world.Group.Members.Replace(added, member) });
        return member;
    }
}
