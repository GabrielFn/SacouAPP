using Sacou.Shared.Members;
using Sacou.Modules.Groups.Domain;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Domain.Members;
using Xunit;
using R = Sacou.Modules.Groups.Tests.Domain.Role;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>D9 to D11 of E3.2: accepting, automatic revocation and the ceiling of open invites. Each refusal has its control.</summary>
public sealed class InviteRulesTests
{
    private static readonly DateTimeOffset Later = GroupBuilder.Now.AddHours(1);
    private static readonly TimeSpan OneSecond = TimeSpan.FromSeconds(1);

    [Fact]
    public void Accept_NewPerson_JoinsAsPlayerAndDropIn_AndCountsOneUse()
    {
        var (world, invite) = WithInvite();
        var person = new UserId(Guid.NewGuid());

        var change = world.Group.Accept(invite, person, personActiveGroups: 0, Later).Value;

        var joined = Assert.Single(change.ChangedMembers);
        Assert.Equal((person, GroupRole.Player, MemberType.DropIn, MembershipStatus.Active, Later), (joined.UserId!.Value, joined.Role, joined.Type, joined.Status, joined.JoinedAt));
        Assert.Null(joined.LeftAt);
        Assert.Equal(1, Assert.Single(change.ChangedInvites).UseCount);
        Assert.Same(joined, change.Group.ActiveMemberOf(person));
    }

    [Fact]
    public void Accept_ActiveMember_IsTheSameMember_AndCountsNoUse()
    {
        var (world, invite) = WithInvite();
        var member = world.Add(GroupRole.Scorekeeper);

        var change = world.Group.Accept(invite, member.UserId!.Value, personActiveGroups: 1, Later).Value;

        Assert.True(change.IsEmpty);
        Assert.Equal(member, change.Group.ActiveMemberOf(member.UserId!.Value));
        Assert.Equal(0, change.Group.Invites.Single().UseCount);
    }

    /// <summary>An admin who left comes back with the same id, but as a player: a role is never restored.</summary>
    [Fact]
    public void Accept_LeftAdmin_ComesBackAsPlayer_WithTheSameId()
    {
        var (world, invite) = WithInvite();
        var left = world.Add(GroupRole.Admin, MembershipStatus.Left) with { Type = MemberType.Regular };
        world.Replace(left);

        var change = world.Group.Accept(invite, left.UserId!.Value, personActiveGroups: 0, Later).Value;

        var back = Assert.Single(change.ChangedMembers);
        Assert.Equal((left.Id, GroupRole.Player, MemberType.DropIn, MembershipStatus.Active), (back.Id, back.Role, back.Type, back.Status));
        Assert.Null(back.LeftAt);
        Assert.Equal(1, change.Group.Invites.Single().UseCount);
    }

    /// <summary>Gabriel's answer 19. The control: whoever left on their own comes back through the same link.</summary>
    [Fact]
    public void Accept_RemovedMember_IsRefused()
    {
        var (world, invite) = WithInvite();
        var removed = world.Add(GroupRole.Player, MembershipStatus.Removed);
        var left = world.Add(GroupRole.Player, MembershipStatus.Left);

        Assert.Equal(GroupErrors.MemberRemoved, world.Group.Accept(invite, removed.UserId!.Value, 0, Later).Error);
        Assert.True(world.Group.Accept(invite, left.UserId!.Value, 0, Later).IsSuccess);
    }

    [Fact]
    public void Accept_RevokedInvite_IsInvalid_ForEveryone()
    {
        var (world, invite) = WithInvite();
        var removed = world.Add(GroupRole.Player, MembershipStatus.Removed);
        var revoked = world.Group.RevokeInvite(world.Founder.Id, invite, GroupBuilder.Now).Value.Group;

        Assert.Equal(GroupErrors.InviteInvalid, revoked.Accept(invite, new UserId(Guid.NewGuid()), 0, Later).Error);
        Assert.Equal(GroupErrors.InviteInvalid, revoked.Accept(invite, removed.UserId!.Value, 0, Later).Error);
        Assert.True(world.Group.Accept(invite, new UserId(Guid.NewGuid()), 0, Later).IsSuccess);
    }

    [Fact]
    public void Accept_UnknownInvite_IsInvalid()
    {
        var (world, _) = WithInvite();

        Assert.Equal(GroupErrors.InviteInvalid, world.Group.Accept(InviteId.New(Later), new UserId(Guid.NewGuid()), 0, Later).Error);
    }

    /// <summary>The expiry boundary, with a fixed clock: one second before is valid, the instant itself and after are not.</summary>
    [Theory]
    [InlineData(-1, true)]
    [InlineData(0, false)]
    [InlineData(1, false)]
    public void Accept_ExpiredInvite_IsInvalid(int secondsFromExpiry, bool accepted)
    {
        var (world, invite) = WithInvite();
        var expiresAt = Later;
        world.Replace(world.Group with { Invites = [world.Group.Invites.Single() with { ExpiresAt = expiresAt }] });

        var result = world.Group.Accept(invite, new UserId(Guid.NewGuid()), 0, expiresAt + (OneSecond * secondsFromExpiry));

        Assert.Equal(accepted, result.IsSuccess);
        Assert.Equal(accepted ? null : GroupErrors.InviteInvalid, result.IsFailure ? result.Error : null);
    }

    [Fact]
    public void Accept_FullGroup_IsRefused_AndOneSeatLessIsNot()
    {
        var (world, invite) = WithInvite();
        for (var member = 1; member < GroupLimits.MaxActiveMembersPerGroup - 1; member++)
        {
            world.Add(GroupRole.Player);
        }

        var almostFull = world.Group;
        world.Add(GroupRole.Player);

        Assert.True(almostFull.Accept(invite, new UserId(Guid.NewGuid()), 0, Later).IsSuccess);
        Assert.Equal(GroupErrors.MemberLimit, world.Group.Accept(invite, new UserId(Guid.NewGuid()), 0, Later).Error);
    }

    [Fact]
    public void Accept_PersonInTooManyGroups_IsRefused()
    {
        var (world, invite) = WithInvite();
        var person = new UserId(Guid.NewGuid());

        Assert.True(world.Group.Accept(invite, person, GroupLimits.MaxActiveGroupsPerPerson - 1, Later).IsSuccess);
        Assert.Equal(GroupErrors.MembershipLimit, world.Group.Accept(invite, person, GroupLimits.MaxActiveGroupsPerPerson, Later).Error);
    }

    /// <summary>D10: whoever loses <c>ManageInvites</c> loses their open invites; an admin made co-admin keeps them.</summary>
    [Theory]
    [InlineData(R.Player, true)]
    [InlineData(R.Scorekeeper, true)]
    [InlineData(R.CoAdmin, false)]
    [InlineData(R.Admin, false)]
    public void ChangeRole_RevokesTheInvitesOfWhoeverLosesThePower(R newRole, bool revoked)
    {
        var world = GroupBuilder.WithFounder();
        var second = world.Add(GroupRole.Admin);
        var invite = CreateInvite(world, second.Id);
        var others = CreateInvite(world, world.Founder.Id);

        var change = world.Group.ChangeRole(world.Founder.Id, second.Id, newRole.ToDomain(), Later).Value;

        Assert.Equal(revoked, !Invite(change.Group, invite).IsValidAt(Later));
        Assert.Equal(revoked ? Later : null, Invite(change.Group, invite).RevokedAt);
        Assert.True(Invite(change.Group, others).IsValidAt(Later));
        Assert.Equal(revoked ? [invite] : Array.Empty<InviteId>(), change.ChangedInvites.Select(changed => changed.Id));
    }

    [Fact]
    public void RemoveAndLeave_RevokeTheInvitesOfWhoeverGoes()
    {
        var world = GroupBuilder.WithFounder();
        var coAdmin = world.Add(GroupRole.CoAdmin);
        var leaver = world.Add(GroupRole.CoAdmin);
        var removedInvite = CreateInvite(world, coAdmin.Id);
        var leftInvite = CreateInvite(world, leaver.Id);
        var foundersInvite = CreateInvite(world, world.Founder.Id);

        var removed = world.Group.Remove(world.Founder.Id, coAdmin.Id, Later).Value.Group;
        var left = removed.Leave(leaver.Id, Later).Value.Group;

        Assert.False(Invite(left, removedInvite).IsValidAt(Later));
        Assert.False(Invite(left, leftInvite).IsValidAt(Later));
        Assert.True(Invite(left, foundersInvite).IsValidAt(Later));
    }

    /// <summary>The automatic revocation never touches what a type change does: no power is lost there.</summary>
    [Fact]
    public void ChangeMemberType_KeepsTheInvites()
    {
        var world = GroupBuilder.WithFounder();
        var invite = CreateInvite(world, world.Founder.Id);

        var change = world.Group.ChangeMemberType(world.Founder.Id, world.Founder.Id, MemberType.Regular).Value;

        Assert.True(change.ChangedInvites.IsEmpty);
        Assert.True(Invite(change.Group, invite).IsValidAt(Later));
    }

    /// <summary>D11: 20 open invites at most; a revoked one frees its place.</summary>
    [Fact]
    public void CreateInvite_StopsAtTheCeiling_AndARevokedOneDoesNotCount()
    {
        var world = GroupBuilder.WithFounder();
        var first = CreateInvite(world, world.Founder.Id);
        for (var invite = 1; invite < InviteRules.MaxActiveInvites; invite++)
        {
            CreateInvite(world, world.Founder.Id);
        }

        var full = world.Group.CreateInvite(world.Founder.Id, InviteId.New(Later), Hash(), Later);
        world.Replace(world.Group.RevokeInvite(world.Founder.Id, first, Later).Value.Group);

        Assert.Equal(20, InviteRules.MaxActiveInvites);
        Assert.Equal(GroupErrors.InviteLimit, full.Error);
        Assert.True(world.Group.CreateInvite(world.Founder.Id, InviteId.New(Later), Hash(), Later).IsSuccess);
    }

    [Fact]
    public void CreateInvite_UsesTheDefaultLifetime_WhichIsNoExpiry()
    {
        var world = GroupBuilder.WithFounder();

        var invite = Invite(world.Group.CreateInvite(world.Founder.Id, InviteId.New(Later), Hash(), Later).Value.Group, null);

        Assert.Null(InviteRules.DefaultLifetime);
        Assert.Equal((Later, null, null, 0, world.Founder.Id), (invite.CreatedAt, invite.ExpiresAt, invite.RevokedAt, invite.UseCount, invite.CreatedBy));
    }

    [Theory]
    [InlineData(R.Scorekeeper)]
    [InlineData(R.Player)]
    public void CreateAndRevoke_NeedManageInvites(R role)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(role.ToDomain());
        var invite = CreateInvite(world, world.Founder.Id);
        var coAdmin = world.Add(GroupRole.CoAdmin);

        Assert.Equal(GroupErrors.Forbidden, world.Group.CreateInvite(actor.Id, InviteId.New(Later), Hash(), Later).Error);
        Assert.Equal(GroupErrors.Forbidden, world.Group.RevokeInvite(actor.Id, invite, Later).Error);
        Assert.True(world.Group.RevokeInvite(coAdmin.Id, invite, Later).IsSuccess);
    }

    [Fact]
    public void RevokeInvite_Twice_IsASuccessWithoutEffect_AndAnotherGroupsInviteIsNotFound()
    {
        var world = GroupBuilder.WithFounder();
        var invite = CreateInvite(world, world.Founder.Id);
        var other = GroupBuilder.WithFounder();
        var othersInvite = CreateInvite(other, other.Founder.Id);

        var once = world.Group.RevokeInvite(world.Founder.Id, invite, Later).Value;
        var twice = once.Group.RevokeInvite(world.Founder.Id, invite, Later.AddHours(1)).Value;

        Assert.Single(once.ChangedInvites);
        Assert.True(twice.IsEmpty);
        Assert.Equal(Later, Invite(twice.Group, invite).RevokedAt);
        Assert.Equal(GroupErrors.InviteNotFound, world.Group.RevokeInvite(world.Founder.Id, othersInvite, Later).Error);
    }

    [Fact]
    public void InactiveActor_GetsTheNotFoundOfANonMember()
    {
        var world = GroupBuilder.WithFounder();
        var left = world.Add(GroupRole.Admin, MembershipStatus.Left);

        Assert.Equal(GroupErrors.GroupNotFound, world.Group.CreateInvite(left.Id, InviteId.New(Later), Hash(), Later).Error);
    }

    private static (GroupBuilder World, InviteId Invite) WithInvite()
    {
        var world = GroupBuilder.WithFounder();
        return (world, CreateInvite(world, world.Founder.Id));
    }

    private static InviteId CreateInvite(GroupBuilder world, MemberId creator)
    {
        var id = InviteId.New(GroupBuilder.Now);
        world.Replace(world.Group.CreateInvite(creator, id, Hash(), GroupBuilder.Now).Value.Group);
        return id;
    }

    /// <summary>The single invite when <paramref name="id"/> is null.</summary>
    private static GroupInvite Invite(Group group, InviteId? id) =>
        id is { } wanted ? group.Invites.Single(invite => invite.Id == wanted) : group.Invites.Single();

    private static InviteTokenHash Hash() => InviteTokenHash.From(Guid.NewGuid().ToByteArray().Concat(Guid.NewGuid().ToByteArray()).ToArray());
}
