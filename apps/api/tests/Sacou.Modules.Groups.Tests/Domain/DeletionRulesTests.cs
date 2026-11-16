using Sacou.Modules.Groups.Domain.Members;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>U2 of E3.16 (ADR 0056, D3): the only active admin blocks the deletion when someone with an account could take over.</summary>
public sealed class DeletionRulesTests
{
    [Fact]
    public void SoleAdmin_WithAPlayerWithAnAccount_Blocks()
    {
        var group = GroupBuilder.WithFounder();
        group.Add(GroupRole.Player);

        Assert.True(DeletionRules.IsDeletionBlocker(group.Group, group.Founder.Id));
    }

    [Fact]
    public void SoleAdmin_WithACoAdmin_Blocks_BecauseACoAdminIsNotAnAdmin()
    {
        var group = GroupBuilder.WithFounder();
        group.Add(GroupRole.CoAdmin);

        Assert.True(DeletionRules.IsDeletionBlocker(group.Group, group.Founder.Id));
    }

    [Fact]
    public void AnotherActiveAdmin_DoesNotBlock()
    {
        var group = GroupBuilder.WithFounder();
        group.Add(GroupRole.Admin);
        group.Add(GroupRole.Player);

        Assert.False(DeletionRules.IsDeletionBlocker(group.Group, group.Founder.Id));
    }

    [Theory]
    [InlineData(Role.CoAdmin)]
    [InlineData(Role.Scorekeeper)]
    [InlineData(Role.Player)]
    public void ANonAdminPerson_NeverBlocks_EvenWhenNoOtherAdminIsLeft(Role role)
    {
        var group = GroupBuilder.WithFounder();
        var person = group.Add(role.ToDomain());
        group.Replace(group.Founder with { Role = GroupRole.Player });

        Assert.False(DeletionRules.IsDeletionBlocker(group.Group, person.Id));
    }

    [Fact]
    public void SoleAdmin_Alone_DoesNotBlock()
    {
        var group = GroupBuilder.WithFounder();

        Assert.False(DeletionRules.IsDeletionBlocker(group.Group, group.Founder.Id));
    }

    [Fact]
    public void SoleAdmin_WithOnlyGuests_DoesNotBlock()
    {
        var group = GroupBuilder.WithFounder();
        group.Add(GroupRole.Player, hasAccount: false);
        group.Add(GroupRole.Player, hasAccount: false);

        Assert.False(DeletionRules.IsDeletionBlocker(group.Group, group.Founder.Id));
    }

    [Theory]
    [InlineData(Status.Left)]
    [InlineData(Status.Removed)]
    public void SoleAdmin_WithOnlyFormerMembersWithAccounts_DoesNotBlock(Status status)
    {
        var group = GroupBuilder.WithFounder();
        group.Add(GroupRole.Player, status.ToDomain());
        group.Add(GroupRole.Admin, status.ToDomain());

        Assert.False(DeletionRules.IsDeletionBlocker(group.Group, group.Founder.Id));
    }

    [Theory]
    [InlineData(Role.CoAdmin)]
    [InlineData(Role.Scorekeeper)]
    [InlineData(Role.Player)]
    public void PersonWhoIsNotAnAdmin_NeverBlocks(Role role)
    {
        var group = GroupBuilder.WithFounder();
        var person = group.Add(role.ToDomain());
        group.Add(GroupRole.Player);

        Assert.False(DeletionRules.IsDeletionBlocker(group.Group, person.Id));
    }

    [Theory]
    [InlineData(Status.Left)]
    [InlineData(Status.Removed)]
    public void FormerAdmin_NeverBlocks(Status status)
    {
        var group = GroupBuilder.WithFounder();
        var former = group.Add(GroupRole.Admin, status.ToDomain());
        group.Replace(group.Founder with { Role = GroupRole.Player });

        Assert.False(DeletionRules.IsDeletionBlocker(group.Group, former.Id));
    }

    [Fact]
    public void MemberOfAnotherGroup_NeverBlocks()
    {
        var group = GroupBuilder.WithFounder();
        group.Add(GroupRole.Player);
        var stranger = GroupBuilder.WithFounder().Founder;

        Assert.False(DeletionRules.IsDeletionBlocker(group.Group, stranger.Id));
    }
}
