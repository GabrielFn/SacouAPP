using System.Reflection;
using Sacou.Modules.Groups.ListMembers;
using Xunit;

namespace Sacou.Modules.Groups.Tests.ListMembers;

/// <summary>P1 of E3.17 (ADR 0051, D7): the member list is the same body for every role, and it has no level.</summary>
public sealed class MemberResponseTests
{
    private const string LevelWord = "Level";
    private const string ResponseSuffix = "Response";

    [Fact]
    public void MemberResponse_HasExactlyItsNineFields()
    {
        Assert.Equal(
            ["HasAccount", "IsMe", "JoinedAt", "MemberId", "MemberType", "Nickname", "OtherPositions", "PrimaryPosition", "Role"],
            typeof(MemberResponse).GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(property => property.Name).Order(StringComparer.Ordinal));
    }

    /// <summary>
    /// No answer of the Groups module names a level. The admin's level routes of E3.17 part 2 are the only ones
    /// that will, and they join this test as a reviewed exception.
    /// </summary>
    [Fact]
    public void NoGroupsResponse_HasALevelProperty()
    {
        var responses = typeof(GroupsModule).Assembly.GetTypes()
            .Where(type => type.Name.EndsWith(ResponseSuffix, StringComparison.Ordinal))
            .ToList();

        Assert.Contains(typeof(MemberResponse), responses);
        Assert.All(responses, type => Assert.DoesNotContain(
            type.GetProperties(BindingFlags.Public | BindingFlags.Instance),
            property => property.Name.Contains(LevelWord, StringComparison.OrdinalIgnoreCase)));
    }
}
