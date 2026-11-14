using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Tests.Domain;
using Sacou.Shared.Levels;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Levels;

/// <summary>P2 of E3.17, the rule of a level write (ADR 0051, D8 and D10), on members as the store reads them under the lock.</summary>
public sealed class MemberLevelsTests
{
    private const int FourAndAHalf = 45;
    private static readonly DateTimeOffset Later = GroupBuilder.Now.AddMinutes(5);

    [Theory]
    [InlineData(Role.Admin)]
    [InlineData(Role.CoAdmin)]
    public void AdminAndCoAdmin_SetALevel(Role role)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(ToDomain(role));
        var target = world.Add(GroupRole.Player);

        var set = MemberLevels.Set(Context(world), actor.Id, [Assign(target.Id, FourAndAHalf)], Later);

        var level = Assert.Single(set.Value.Levels);
        Assert.Equal(new MemberLevel(target.Id, world.Group.Id, Level(FourAndAHalf), actor.Id, Later), level);
    }

    [Theory]
    [InlineData(Role.Scorekeeper)]
    [InlineData(Role.Player)]
    public void ScorekeeperAndPlayer_AreForbidden(Role role)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(ToDomain(role));

        var set = MemberLevels.Set(Context(world), actor.Id, [Assign(world.Founder.Id, FourAndAHalf)], Later);

        Assert.Equal(GroupErrors.Forbidden, set.Error);
    }

    /// <summary>An actor removed or gone between the filter and the lock is a non-member, as on every member write.</summary>
    [Theory]
    [InlineData(Status.Left)]
    [InlineData(Status.Removed)]
    public void ActorNoLongerActive_GetsGroupNotFound(Status status)
    {
        var world = GroupBuilder.WithFounder();
        var actor = world.Add(GroupRole.Admin, ToDomain(status));

        var set = MemberLevels.Set(Context(world), actor.Id, [Assign(world.Founder.Id, FourAndAHalf)], Later);

        Assert.Equal(GroupErrors.GroupNotFound, set.Error);
    }

    [Fact]
    public void ActorOfAnotherGroup_GetsGroupNotFound()
    {
        var world = GroupBuilder.WithFounder();

        var set = MemberLevels.Set(Context(world), MemberId.New(Later), [Assign(world.Founder.Id, FourAndAHalf)], Later);

        Assert.Equal(GroupErrors.GroupNotFound, set.Error);
    }

    [Theory]
    [InlineData(Status.Left)]
    [InlineData(Status.Removed)]
    public void TargetNoLongerActive_IsNotFound(Status status)
    {
        var world = GroupBuilder.WithFounder();
        var target = world.Add(GroupRole.Player, ToDomain(status));

        var set = MemberLevels.Set(Context(world), world.Founder.Id, [Assign(target.Id, FourAndAHalf)], Later);

        Assert.Equal(GroupErrors.MemberNotFound, set.Error);
    }

    [Fact]
    public void TargetOfAnotherGroupOrUnknown_IsNotFound()
    {
        var world = GroupBuilder.WithFounder();
        var other = GroupBuilder.WithFounder();

        var foreign = MemberLevels.Set(Context(world), world.Founder.Id, [Assign(other.Founder.Id, FourAndAHalf)], Later);
        var unknown = MemberLevels.Set(Context(world), world.Founder.Id, [Assign(MemberId.New(Later), FourAndAHalf)], Later);

        Assert.Equal(GroupErrors.MemberNotFound, foreign.Error);
        Assert.Equal(GroupErrors.MemberNotFound, unknown.Error);
    }

    /// <summary>ADR 0047: "de cada membro". The level gives no power, so the admins and the actor are targets too.</summary>
    [Fact]
    public void AdminsAndTheActor_AreTargetsToo()
    {
        var world = GroupBuilder.WithFounder();
        var coAdmin = world.Add(GroupRole.CoAdmin);

        var set = MemberLevels.Set(Context(world), coAdmin.Id, [Assign(world.Founder.Id, FourAndAHalf), Assign(coAdmin.Id, null)], Later);

        Assert.Equal([world.Founder.Id, coAdmin.Id], set.Value.Levels.Select(level => level.MemberId));
    }

    [Fact]
    public void EmptyBatch_TooLongBatch_AndRepeatedMember_AreInvalid()
    {
        var world = GroupBuilder.WithFounder();
        var targets = Enumerable.Range(0, MemberLevelLimits.MaxBatch + 1).Select(_ => world.Add(GroupRole.Player)).ToList();
        var actor = world.Founder.Id;

        var empty = MemberLevels.Set(Context(world), actor, [], Later);
        var tooLong = MemberLevels.Set(Context(world), actor, [.. targets.Select(target => Assign(target.Id, FourAndAHalf))], Later);
        var repeated = MemberLevels.Set(Context(world), actor, [Assign(targets[0].Id, FourAndAHalf), Assign(targets[0].Id, null)], Later);
        var full = MemberLevels.Set(
            Context(world), actor, [.. targets.Take(MemberLevelLimits.MaxBatch).Select(target => Assign(target.Id, FourAndAHalf))], Later);

        Assert.Equal(GroupErrors.LevelInvalid, empty.Error);
        Assert.Equal(GroupErrors.LevelInvalid, tooLong.Error);
        Assert.Equal(GroupErrors.LevelInvalid, repeated.Error);
        Assert.Equal(MemberLevelLimits.MaxBatch, full.Value.Levels.Length);
    }

    /// <summary>The limit is a contract (4 KB body): pinned to the literal, not to the constant under test.</summary>
    [Fact]
    public void BatchLimit_IsExactlyFifty()
    {
        const int Fifty = 50;
        var world = GroupBuilder.WithFounder();
        var targets = Enumerable.Range(0, Fifty + 1).Select(_ => world.Add(GroupRole.Player)).ToList();
        var actor = world.Founder.Id;

        var atLimit = MemberLevels.Set(Context(world), actor, [.. targets.Take(Fifty).Select(target => Assign(target.Id, FourAndAHalf))], Later);
        var over = MemberLevels.Set(Context(world), actor, [.. targets.Select(target => Assign(target.Id, FourAndAHalf))], Later);

        Assert.True(atLimit.IsSuccess);
        Assert.Equal(GroupErrors.LevelInvalid, over.Error);
    }

    /// <summary>All or nothing: one bad target among three fails the whole batch, with nothing to write.</summary>
    [Fact]
    public void OneBadTargetInABatch_FailsTheWholeBatch()
    {
        var world = GroupBuilder.WithFounder();
        var first = world.Add(GroupRole.Player);
        var gone = world.Add(GroupRole.Player, MembershipStatus.Left);
        var third = world.Add(GroupRole.Player);

        var set = MemberLevels.Set(
            Context(world),
            world.Founder.Id,
            [Assign(first.Id, FourAndAHalf), Assign(gone.Id, FourAndAHalf), Assign(third.Id, FourAndAHalf)],
            Later);

        Assert.True(set.IsFailure);
        Assert.Equal(GroupErrors.MemberNotFound, set.Error);
    }

    /// <summary>"Não sei" is a reviewed row without a level; the same value again is a success with the new time.</summary>
    [Fact]
    public void DontKnow_IsAReviewedRowWithoutALevel_AndTheSameValueRenewsTheTime()
    {
        var world = GroupBuilder.WithFounder();
        var target = world.Add(GroupRole.Player);

        var dontKnow = MemberLevels.Set(Context(world), world.Founder.Id, [Assign(target.Id, null)], Later);
        var again = MemberLevels.Set(Context(world), world.Founder.Id, [Assign(target.Id, null)], Later.AddMinutes(1));

        Assert.Null(Assert.Single(dontKnow.Value.Levels).Level);
        Assert.Equal(Later.AddMinutes(1), Assert.Single(again.Value.Levels).SetAt);
    }

    private static MemberLevelContext Context(GroupBuilder world) => new(world.Group.Id, world.Group.Members);

    private static LevelAssignment Assign(MemberId member, int? tenths) => new(member, tenths is { } value ? Level(value) : null);

    private static SkillLevel Level(int tenths) => SkillLevel.FromTenths(tenths).Value;

    private static GroupRole ToDomain(Role role) => Enum.Parse<GroupRole>(role.ToString());

    private static MembershipStatus ToDomain(Status status) => Enum.Parse<MembershipStatus>(status.ToString());
}
