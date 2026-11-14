using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Tests.Domain;
using Sacou.Shared.Levels;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Guests;

/// <summary>G2 to G5 of E3.5 (ADR 0053): adding, correcting and removing a guest, and what a guest never becomes.</summary>
public sealed class GuestRulesTests
{
    private static readonly DateTimeOffset Later = GroupBuilder.Now.AddHours(1);
    private static readonly GuestProfile Leo = new(GuestName.Create("Léo").Value, GuestPosition.Libero);

    /// <summary>G2: a player, a drop-in, active, without a user id, with a member id of its own and its profile.</summary>
    [Fact]
    public void AddGuest_IsAnActiveDropInPlayerWithoutAnAccount()
    {
        var world = GroupBuilder.WithFounder();
        var requestId = Guid.NewGuid();

        var admission = world.Group.AddGuest(world.Founder.Id, requestId, Leo, level: null, Later).Value;

        Assert.True(admission.Created);
        var member = Assert.Single(admission.Change.ChangedMembers);
        Assert.Equal(new GroupMember(admission.Guest.MemberId, null, GroupRole.Player, MemberType.DropIn, MembershipStatus.Active, Later, null), member);
        Assert.Equal(new Guest(member.Id, Leo, requestId, Later), Assert.Single(admission.Change.ChangedGuests));
        Assert.Empty(admission.Change.NewLevels);
        Assert.Contains(member, admission.Change.Group.ActiveMembers);
    }

    [Fact]
    public void AddGuest_WithALevel_WritesItByTheActor()
    {
        var world = GroupBuilder.WithFounder();
        var four = SkillLevel.FromDecimal(4.0m).Value;

        var rated = world.Group.AddGuest(world.Founder.Id, Guid.NewGuid(), Leo, four, Later).Value;

        var level = Assert.Single(rated.Change.NewLevels);
        Assert.Equal((rated.Guest.MemberId, (SkillLevel?)four, world.Founder.Id, world.Group.Id), (level.MemberId, level.Level, level.SetBy, level.GroupId));
    }

    /// <summary>D5: the same request id again finds the first guest, whatever name it carries, and writes nothing.</summary>
    [Fact]
    public void SameRequestId_FindsTheFirstGuest_AndWritesNothing()
    {
        var world = GroupBuilder.WithFounder();
        var requestId = Guid.NewGuid();
        var first = world.Group.AddGuest(world.Founder.Id, requestId, Leo, level: null, Later).Value;
        world.Replace(first.Change.Group);

        var again = world.Group.AddGuest(world.Founder.Id, requestId, new GuestProfile(GuestName.Create("Outro").Value, null), level: null, Later).Value;

        Assert.False(again.Created);
        Assert.Equal(first.Guest, again.Guest);
        Assert.True(again.Change.IsEmpty);
    }

    [Theory]
    [InlineData(Role.Scorekeeper)]
    [InlineData(Role.Player)]
    public void AddGuest_ByScorekeeperOrPlayer_IsForbidden(Role role)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(role.ToDomain());

        Assert.Equal(GroupErrors.Forbidden, world.Group.AddGuest(actor.Id, Guid.NewGuid(), Leo, level: null, Later).Error);
    }

    [Fact]
    public void AddGuest_ByCoAdmin_IsAllowed_AndByAFormerMember_IsNotFound()
    {
        var world = GroupBuilder.WithFounder();
        var coAdmin = world.Add(GroupRole.CoAdmin);
        var removed = world.Add(GroupRole.Admin, MembershipStatus.Removed);

        Assert.True(world.Group.AddGuest(coAdmin.Id, Guid.NewGuid(), Leo, level: null, Later).IsSuccess);
        Assert.Equal(GroupErrors.GroupNotFound, world.Group.AddGuest(removed.Id, Guid.NewGuid(), Leo, level: null, Later).Error);
    }

    /// <summary>G2 and D11: guests and accounts count together; the 301st active member is refused, a removed one does not count.</summary>
    [Fact]
    public void AddGuest_ThreeHundredAndFirst_IsTheMemberLimit()
    {
        var world = GroupBuilder.WithFounder();
        for (var count = 1; count < 150; count++)
        {
            world.Add(GroupRole.Player);
        }

        for (var count = 150; count < 300; count++)
        {
            world.Replace(world.Group.AddGuest(world.Founder.Id, Guid.NewGuid(), Leo, level: null, Later).Value.Change.Group);
        }

        Assert.Equal(300, world.Group.ActiveMembers.Count());
        Assert.Equal(GroupErrors.MemberLimit, world.Group.AddGuest(world.Founder.Id, Guid.NewGuid(), Leo, level: null, Later).Error);

        world.Replace(world.Group.Remove(world.Founder.Id, world.Group.Guests[0].MemberId, Later).Value.Group);
        Assert.True(world.Group.AddGuest(world.Founder.Id, Guid.NewGuid(), Leo, level: null, Later).IsSuccess);
    }

    /// <summary>A resend still finds its guest when the group is full: the limit is about new members only.</summary>
    [Fact]
    public void SameRequestId_OnAFullGroup_StillFindsTheGuest()
    {
        var world = GroupBuilder.WithFounder();
        var requestId = Guid.NewGuid();
        world.Replace(world.Group.AddGuest(world.Founder.Id, requestId, Leo, level: null, Later).Value.Change.Group);
        for (var count = 2; count < 300; count++)
        {
            world.Add(GroupRole.Player);
        }

        Assert.False(world.Group.AddGuest(world.Founder.Id, requestId, Leo, level: null, Later).Value.Created);
    }

    /// <summary>G3 and D8: a guest is never a mensalista, and only ever a player.</summary>
    [Theory]
    [InlineData(Role.Scorekeeper)]
    [InlineData(Role.CoAdmin)]
    [InlineData(Role.Admin)]
    public void Guest_NeverGetsARoleThatNeedsTheApp(Role role)
    {
        var (world, guest) = WithGuest();

        Assert.Equal("groups.role-needs-account", world.Group.ChangeRole(world.Founder.Id, guest, role.ToDomain(), Later).Error.Code);
    }

    [Fact]
    public void Guest_AsPlayer_IsUnchanged_AndAsRegular_NeedsAnAccount()
    {
        var (world, guest) = WithGuest();

        Assert.True(world.Group.ChangeRole(world.Founder.Id, guest, GroupRole.Player, Later).Value.IsEmpty);
        Assert.Equal(GroupErrors.RegularNeedsAccount, world.Group.ChangeMemberType(world.Founder.Id, guest, MemberType.Regular).Error);
    }

    /// <summary>The control: a member with an account still becomes a scorekeeper.</summary>
    [Fact]
    public void MemberWithAnAccount_StillGetsAnyRole()
    {
        var world = GroupBuilder.WithFounder();
        var player = world.Add(GroupRole.Player);

        Assert.True(world.Group.ChangeRole(world.Founder.Id, player.Id, GroupRole.Scorekeeper, Later).IsSuccess);
    }

    /// <summary>G4 and D9: the guest is removed, and its profile goes with it in the same change.</summary>
    [Fact]
    public void RemovingAGuest_RemovesTheMember_AndForgetsTheProfile()
    {
        var (world, guest) = WithGuest();

        var change = world.Group.Remove(world.Founder.Id, guest, Later).Value;

        Assert.Equal(MembershipStatus.Removed, Assert.Single(change.ChangedMembers).Status);
        Assert.Equal([guest], change.RemovedGuests);
        Assert.Empty(change.Group.Guests);
    }

    [Fact]
    public void RemovingAMemberWithAnAccount_ForgetsNoProfile()
    {
        var (world, _) = WithGuest();
        var player = world.Add(GroupRole.Player);

        var change = world.Group.Remove(world.Founder.Id, player.Id, Later).Value;

        Assert.Empty(change.RemovedGuests);
        Assert.Single(change.Group.Guests);
    }

    [Fact]
    public void CorrectGuest_ReplacesTheProfile_AndTheSameValuesWriteNothing()
    {
        var (world, guest) = WithGuest();
        var corrected = new GuestProfile(GuestName.Create("Leozinho").Value, null);

        var change = world.Group.CorrectGuest(world.Founder.Id, guest, corrected).Value;
        var same = world.Group.CorrectGuest(world.Founder.Id, guest, Leo).Value;

        Assert.Equal(corrected, Assert.Single(change.ChangedGuests).Profile);
        Assert.Equal(corrected, Assert.Single(change.Group.Guests).Profile);
        Assert.True(same.IsEmpty);
    }

    /// <summary>D9: an account, a removed guest and a member of nowhere look the same.</summary>
    [Fact]
    public void CorrectGuest_OnAnythingButAnActiveGuest_IsMemberNotFound()
    {
        var (world, guest) = WithGuest();
        var player = world.Add(GroupRole.Player);
        var correction = new GuestProfile(GuestName.Create("X").Value, null);
        var afterRemoval = world.Group.Remove(world.Founder.Id, guest, Later).Value.Group;

        Assert.Equal(GroupErrors.MemberNotFound, world.Group.CorrectGuest(world.Founder.Id, player.Id, correction).Error);
        Assert.Equal(GroupErrors.MemberNotFound, world.Group.CorrectGuest(world.Founder.Id, MemberId.New(Later), correction).Error);
        Assert.Equal(GroupErrors.MemberNotFound, afterRemoval.CorrectGuest(world.Founder.Id, guest, correction).Error);
    }

    [Fact]
    public void CorrectGuest_ByAPlayer_IsForbidden()
    {
        var (world, guest) = WithGuest();
        var player = world.Add(GroupRole.Player);

        Assert.Equal(GroupErrors.Forbidden, world.Group.CorrectGuest(player.Id, guest, Leo).Error);
    }

    /// <summary>G5: the five concrete positions, in any case; "any", another sport and a list are refused.</summary>
    [Theory]
    [InlineData("setter", nameof(GuestPosition.Setter))]
    [InlineData("outsideHitter", nameof(GuestPosition.OutsideHitter))]
    [InlineData("opposite", nameof(GuestPosition.Opposite))]
    [InlineData("middleBlocker", nameof(GuestPosition.MiddleBlocker))]
    [InlineData("libero", nameof(GuestPosition.Libero))]
    [InlineData("LIBERO", nameof(GuestPosition.Libero))]
    [InlineData("MiddleBlocker", nameof(GuestPosition.MiddleBlocker))]
    public void Positions_TheFiveConcreteOnes_InAnyCase(string text, string expected)
    {
        Assert.Equal(Enum.Parse<GuestPosition>(expected), GuestPositions.Parse(text).Value);
    }

    [Theory]
    [InlineData("any")]
    [InlineData("Goleiro")]
    [InlineData("setter,libero")]
    [InlineData("")]
    [InlineData(" setter")]
    [InlineData(null)]
    public void Positions_AnythingElse_IsGuestInvalid(string? text)
    {
        Assert.Equal("groups.guest-invalid", GuestPositions.Parse(text).Error.Code);
    }

    private static (GroupBuilder World, MemberId Guest) WithGuest()
    {
        var world = GroupBuilder.WithFounder();
        var admission = world.Group.AddGuest(world.Founder.Id, Guid.NewGuid(), Leo, level: null, GroupBuilder.Now).Value;
        world.Replace(admission.Change.Group);
        return (world, admission.Guest.MemberId);
    }
}
