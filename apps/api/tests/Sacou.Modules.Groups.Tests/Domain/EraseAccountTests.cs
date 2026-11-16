using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>U3 of E3.16 (ADR 0056, D1 and D2): the person becomes a former player, the history keeps the member id.</summary>
public sealed class EraseAccountTests
{
    private static readonly DateTimeOffset Later = GroupBuilder.Now.AddDays(3);

    [Fact]
    public void ActiveMember_LeavesNow_WithoutAUserId_AndKeepsIdAndRole()
    {
        var world = GroupBuilder.WithFounder();
        var player = world.Add(GroupRole.Scorekeeper);

        var change = world.Group.EraseAccount(player.UserId!.Value, Later);

        var erased = Assert.Single(change.ChangedMembers);
        Assert.Equal(player.Id, erased.Id);
        Assert.Null(erased.UserId);
        Assert.Equal(MembershipStatus.Left, erased.Status);
        Assert.Equal(Later, erased.LeftAt);
        Assert.Equal(GroupRole.Scorekeeper, erased.Role);
        Assert.Equal(player.JoinedAt, erased.JoinedAt);
        Assert.Equal(erased, change.Group.Members.Single(member => member.Id == player.Id));
    }

    [Theory]
    [InlineData(Status.Left)]
    [InlineData(Status.Removed)]
    public void FormerMember_KeepsStatusAndDate_AndLosesOnlyTheUserId(Status status)
    {
        var world = GroupBuilder.WithFounder();
        var former = world.Add(GroupRole.Player, status.ToDomain());

        var erased = Assert.Single(world.Group.EraseAccount(former.UserId!.Value, Later).ChangedMembers);

        Assert.Equal(former with { UserId = null }, erased);
    }

    /// <summary>The deletion rule was judged before: the only admin may go, and the last-admin rule does not fire.</summary>
    [Fact]
    public void SoleAdmin_IsErased_WithoutTheLastAdminRule()
    {
        var world = GroupBuilder.WithFounder();
        world.Add(GroupRole.Player, hasAccount: false);

        var change = world.Group.EraseAccount(world.Founder.UserId!.Value, Later);

        Assert.DoesNotContain(change.Group.ActiveMembers, member => member.IsActiveAdmin);
        Assert.Equal(GroupRole.Admin, Assert.Single(change.ChangedMembers).Role);
    }

    [Fact]
    public void OpenInvitesOfThePerson_AreRevoked_OthersStay()
    {
        var world = GroupBuilder.WithFounder();
        var other = world.Add(GroupRole.Admin);
        var mine = CreateInvite(world, world.Founder.Id);
        var theirs = CreateInvite(world, other.Id);

        var change = world.Group.EraseAccount(world.Founder.UserId!.Value, Later);

        var revoked = Assert.Single(change.ChangedInvites);
        Assert.Equal(mine, revoked.Id);
        Assert.Equal(Later, revoked.RevokedAt);
        Assert.Null(change.Group.Invites.Single(invite => invite.Id == theirs).RevokedAt);
    }

    [Fact]
    public void PersonNotInTheGroup_ChangesNothing()
    {
        var world = GroupBuilder.WithFounder();

        var change = world.Group.EraseAccount(new UserId(Guid.NewGuid()), Later);

        Assert.True(change.IsEmpty);
        Assert.Equal(world.Group, change.Group);
    }

    /// <summary>Question 64: the last member with an account goes, so the guests' names go too; their member ids stay.</summary>
    [Fact]
    public void LastMemberWithAnAccount_TakesTheGuestNamesAlong()
    {
        var world = WithGuests(out var guests);

        var change = world.Group.EraseAccount(world.Founder.UserId!.Value, Later);

        Assert.Equal(guests, change.RemovedGuests.OrderBy(id => id.Value));
        Assert.Empty(change.Group.Guests);
        Assert.All(guests, guest => Assert.True(change.Group.Members.Single(member => member.Id == guest).IsActive));
    }

    [Fact]
    public void AnotherMemberWithAnAccountLeft_KeepsTheGuestNames()
    {
        var world = WithGuests(out _);
        world.Add(GroupRole.Player);

        var change = world.Group.EraseAccount(world.Founder.UserId!.Value, Later);

        Assert.Empty(change.RemovedGuests);
        Assert.Equal(2, change.Group.Guests.Length);
    }

    /// <summary>A former member who deletes the account later changes nothing for the guests: they lost no one now.</summary>
    [Fact]
    public void FormerMember_LeavesTheGuestsAlone()
    {
        var world = WithGuests(out _);
        var former = world.Add(GroupRole.Player, MembershipStatus.Left);
        world.Replace(world.Founder.Leave(GroupBuilder.Now));

        var change = world.Group.EraseAccount(former.UserId!.Value, Later);

        Assert.Empty(change.RemovedGuests);
    }

    private static GroupBuilder WithGuests(out MemberId[] guests)
    {
        var world = GroupBuilder.WithFounder();
        var first = world.Add(GroupRole.Player, hasAccount: false);
        var second = world.Add(GroupRole.Player, hasAccount: false);
        var profile = new GuestProfile(GuestName.Create("Léo").Value, Position: null);
        world.Replace(world.Group with
        {
            Guests = [new Guest(first.Id, profile, Guid.NewGuid(), GroupBuilder.Now), new Guest(second.Id, profile, Guid.NewGuid(), GroupBuilder.Now)],
        });
        guests = [.. new[] { first.Id, second.Id }.OrderBy(id => id.Value)];
        return world;
    }

    private static InviteId CreateInvite(GroupBuilder world, MemberId creator)
    {
        var id = InviteId.New(GroupBuilder.Now);
        var hash = InviteTokenHash.From([.. Guid.NewGuid().ToByteArray(), .. Guid.NewGuid().ToByteArray()]);
        world.Replace(world.Group.CreateInvite(creator, id, hash, GroupBuilder.Now).Value.Group);
        return id;
    }
}
