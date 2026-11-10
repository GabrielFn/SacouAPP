using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Xunit;
using O = Sacou.Modules.Groups.Tests.Domain.ChangeRoleTests.Outcome;
using R = Sacou.Modules.Groups.Tests.Domain.Role;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>
/// D4: actor × target × new role, written by hand from docs/dominio/grupos.md (Gabriel, question 16), never
/// derived from the production table. The target is someone else; the founder is one more admin, so the last
/// admin rule (D5) never decides a row here.
/// </summary>
public sealed class ChangeRoleTests
{
    public enum Outcome
    {
        Changed,
        Same,
        Forbidden,
    }

    public static readonly TheoryData<R, R, R, O> Rows = new()
    {
        { R.Admin, R.Admin, R.Admin, O.Same },
        { R.Admin, R.Admin, R.CoAdmin, O.Changed },
        { R.Admin, R.Admin, R.Scorekeeper, O.Changed },
        { R.Admin, R.Admin, R.Player, O.Changed },

        { R.Admin, R.CoAdmin, R.Admin, O.Changed },
        { R.Admin, R.CoAdmin, R.CoAdmin, O.Same },
        { R.Admin, R.CoAdmin, R.Scorekeeper, O.Changed },
        { R.Admin, R.CoAdmin, R.Player, O.Changed },

        { R.Admin, R.Scorekeeper, R.Admin, O.Changed },
        { R.Admin, R.Scorekeeper, R.CoAdmin, O.Changed },
        { R.Admin, R.Scorekeeper, R.Scorekeeper, O.Same },
        { R.Admin, R.Scorekeeper, R.Player, O.Changed },

        { R.Admin, R.Player, R.Admin, O.Changed },
        { R.Admin, R.Player, R.CoAdmin, O.Changed },
        { R.Admin, R.Player, R.Scorekeeper, O.Changed },
        { R.Admin, R.Player, R.Player, O.Same },

        { R.CoAdmin, R.Admin, R.Admin, O.Forbidden },
        { R.CoAdmin, R.Admin, R.CoAdmin, O.Forbidden },
        { R.CoAdmin, R.Admin, R.Scorekeeper, O.Forbidden },
        { R.CoAdmin, R.Admin, R.Player, O.Forbidden },

        { R.CoAdmin, R.CoAdmin, R.Admin, O.Forbidden },
        { R.CoAdmin, R.CoAdmin, R.CoAdmin, O.Forbidden },
        { R.CoAdmin, R.CoAdmin, R.Scorekeeper, O.Forbidden },
        { R.CoAdmin, R.CoAdmin, R.Player, O.Forbidden },

        { R.CoAdmin, R.Scorekeeper, R.Admin, O.Forbidden },
        { R.CoAdmin, R.Scorekeeper, R.CoAdmin, O.Forbidden },
        { R.CoAdmin, R.Scorekeeper, R.Scorekeeper, O.Same },
        { R.CoAdmin, R.Scorekeeper, R.Player, O.Changed },

        { R.CoAdmin, R.Player, R.Admin, O.Forbidden },
        { R.CoAdmin, R.Player, R.CoAdmin, O.Forbidden },
        { R.CoAdmin, R.Player, R.Scorekeeper, O.Changed },
        { R.CoAdmin, R.Player, R.Player, O.Same },

        { R.Scorekeeper, R.Admin, R.Admin, O.Forbidden },
        { R.Scorekeeper, R.Admin, R.CoAdmin, O.Forbidden },
        { R.Scorekeeper, R.Admin, R.Scorekeeper, O.Forbidden },
        { R.Scorekeeper, R.Admin, R.Player, O.Forbidden },

        { R.Scorekeeper, R.CoAdmin, R.Admin, O.Forbidden },
        { R.Scorekeeper, R.CoAdmin, R.CoAdmin, O.Forbidden },
        { R.Scorekeeper, R.CoAdmin, R.Scorekeeper, O.Forbidden },
        { R.Scorekeeper, R.CoAdmin, R.Player, O.Forbidden },

        { R.Scorekeeper, R.Scorekeeper, R.Admin, O.Forbidden },
        { R.Scorekeeper, R.Scorekeeper, R.CoAdmin, O.Forbidden },
        { R.Scorekeeper, R.Scorekeeper, R.Scorekeeper, O.Forbidden },
        { R.Scorekeeper, R.Scorekeeper, R.Player, O.Forbidden },

        { R.Scorekeeper, R.Player, R.Admin, O.Forbidden },
        { R.Scorekeeper, R.Player, R.CoAdmin, O.Forbidden },
        { R.Scorekeeper, R.Player, R.Scorekeeper, O.Forbidden },
        { R.Scorekeeper, R.Player, R.Player, O.Forbidden },

        { R.Player, R.Admin, R.Admin, O.Forbidden },
        { R.Player, R.Admin, R.CoAdmin, O.Forbidden },
        { R.Player, R.Admin, R.Scorekeeper, O.Forbidden },
        { R.Player, R.Admin, R.Player, O.Forbidden },

        { R.Player, R.CoAdmin, R.Admin, O.Forbidden },
        { R.Player, R.CoAdmin, R.CoAdmin, O.Forbidden },
        { R.Player, R.CoAdmin, R.Scorekeeper, O.Forbidden },
        { R.Player, R.CoAdmin, R.Player, O.Forbidden },

        { R.Player, R.Scorekeeper, R.Admin, O.Forbidden },
        { R.Player, R.Scorekeeper, R.CoAdmin, O.Forbidden },
        { R.Player, R.Scorekeeper, R.Scorekeeper, O.Forbidden },
        { R.Player, R.Scorekeeper, R.Player, O.Forbidden },

        { R.Player, R.Player, R.Admin, O.Forbidden },
        { R.Player, R.Player, R.CoAdmin, O.Forbidden },
        { R.Player, R.Player, R.Scorekeeper, O.Forbidden },
        { R.Player, R.Player, R.Player, O.Forbidden },
    };

    [Fact]
    public void Rows_CoverEveryActorTargetAndRole()
    {
        var roles = Enum.GetValues<GroupRole>().Length;

        Assert.Equal(roles * roles * roles, Rows.Select(row => (row.Data.Item1, row.Data.Item2, row.Data.Item3)).Distinct().Count());
        Assert.Equal(roles * roles * roles, Rows.Count);
    }

    [Theory]
    [MemberData(nameof(Rows))]
    public void ChangeRole_FollowsTheTable(R actorRole, R targetRole, R newRole, O outcome)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(actorRole.ToDomain());
        var target = world.Add(targetRole.ToDomain());

        var result = world.Group.ChangeRole(actor.Id, target.Id, newRole.ToDomain());

        switch (outcome)
        {
            case O.Forbidden:
                Assert.Equal(GroupErrors.Forbidden, result.Error);
                break;
            case O.Same:
                Assert.True(result.Value.IsEmpty);
                Assert.Equal(world.Group, result.Value.Group);
                break;
            default:
                var changed = Assert.Single(result.Value.ChangedMembers);
                Assert.Equal(target with { Role = newRole.ToDomain() }, changed);
                Assert.Equal(newRole.ToDomain(), result.Value.Group.Members.Single(member => member.Id == target.Id).Role);
                break;
        }
    }

    [Fact]
    public void Admin_DemotesThemselvesWhileAnotherAdminStays()
    {
        var world = GroupBuilder.WithFounder();
        world.Add(R.Admin.ToDomain());

        var result = world.Group.ChangeRole(world.Founder.Id, world.Founder.Id, R.Player.ToDomain());

        Assert.Equal(R.Player.ToDomain(), Assert.Single(result.Value.ChangedMembers).Role);
    }

    [Theory]
    [InlineData(R.Scorekeeper, R.Admin)]
    [InlineData(R.Player, R.CoAdmin)]
    [InlineData(R.CoAdmin, R.Admin)]
    [InlineData(R.CoAdmin, R.Player)]
    public void NobodyButAnAdmin_ChangesTheirOwnRole(R actorRole, R newRole)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(actorRole.ToDomain());

        Assert.Equal(GroupErrors.Forbidden, world.Group.ChangeRole(actor.Id, actor.Id, newRole.ToDomain()).Error);
    }

    [Theory]
    [InlineData(Status.Left)]
    [InlineData(Status.Removed)]
    public void InactiveTarget_IsNotFound(Status status)
    {
        var world = GroupBuilder.WithFounder();
        var target = world.Add(R.Player.ToDomain(), status.ToDomain());
        var active = world.Add(R.Player.ToDomain());

        Assert.Equal(GroupErrors.MemberNotFound, world.Group.ChangeRole(world.Founder.Id, target.Id, R.Scorekeeper.ToDomain()).Error);
        Assert.True(world.Group.ChangeRole(world.Founder.Id, active.Id, R.Scorekeeper.ToDomain()).IsSuccess);
    }

    [Fact]
    public void TargetOfAnotherGroup_IsNotFound()
    {
        var world = GroupBuilder.WithFounder();
        var other = GroupBuilder.WithFounder();
        var stranger = other.Add(R.Player.ToDomain());

        Assert.Equal(GroupErrors.MemberNotFound, world.Group.ChangeRole(world.Founder.Id, stranger.Id, R.Admin.ToDomain()).Error);
    }

    /// <summary>The actor is judged by the aggregate under the lock: one who left after the filter is a non-member.</summary>
    [Fact]
    public void ActorNoLongerActive_GetsTheGroupNotFound()
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(R.Admin.ToDomain(), MembershipStatus.Removed);
        var target = world.Add(R.Player.ToDomain());

        Assert.Equal(GroupErrors.GroupNotFound, world.Group.ChangeRole(actor.Id, target.Id, R.Admin.ToDomain()).Error);
    }
}
