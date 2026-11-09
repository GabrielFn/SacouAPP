using System.Globalization;
using Sacou.Modules.Groups.Domain;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>D2 and D8: the founder, the ids and the ceilings.</summary>
public sealed class GroupTests
{
    private const int UuidVersion7 = 7;
    private const int TimestampHexDigits = 12;

    private static readonly DateTimeOffset Now = new(2026, 11, 9, 14, 30, 15, 123, TimeSpan.Zero);

    [Fact]
    public void Create_MakesTheCreatorAnActiveDropInAdmin()
    {
        var creator = new UserId(Guid.NewGuid());

        var group = Group.Create(GroupName.Create("Racha").Value, creator, Now);

        var founder = Assert.Single(group.Members);
        Assert.Equal(creator, founder.UserId);
        Assert.Equal(GroupRole.Admin, founder.Role);
        Assert.Equal(MemberType.DropIn, founder.Type);
        Assert.Equal(MembershipStatus.Active, founder.Status);
        Assert.Equal(Now, founder.JoinedAt);
        Assert.Null(founder.LeftAt);
        Assert.Equal(Now, group.CreatedAt);
        Assert.Equal([founder], group.ActiveMembers);
    }

    [Fact]
    public void Create_UsesVersion7IdsFromTheGivenClock()
    {
        var group = Group.Create(GroupName.Create("Racha").Value, new UserId(Guid.NewGuid()), Now);
        var expectedTime = Now.ToUnixTimeMilliseconds().ToString("x" + TimestampHexDigits, CultureInfo.InvariantCulture);

        Assert.All(
            new[] { group.Id.Value, group.Members[0].Id.Value },
            id =>
            {
                Assert.Equal(UuidVersion7, id.Version);
                Assert.StartsWith(expectedTime, id.ToString("N"), StringComparison.Ordinal);
            });
        Assert.NotEqual(group.Id.Value, group.Members[0].Id.Value);
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(299, true)]
    [InlineData(300, false)]
    public void MemberCeiling_TakesTheThreeHundredthAndRefusesTheNext(int activeMembers, bool admitted)
    {
        var result = GroupLimits.CanTakeAnotherMember(activeMembers);

        Assert.Equal(admitted, result.IsSuccess);
        if (!admitted)
        {
            Assert.Equal(GroupErrors.MemberLimit, result.Error);
        }
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(99, true)]
    [InlineData(100, false)]
    public void GroupCeiling_TakesTheHundredthAndRefusesTheNext(int activeGroups, bool admitted)
    {
        var result = GroupLimits.CanJoinAnotherGroup(activeGroups);

        Assert.Equal(admitted, result.IsSuccess);
        if (!admitted)
        {
            Assert.Equal(GroupErrors.MembershipLimit, result.Error);
        }
    }
}
