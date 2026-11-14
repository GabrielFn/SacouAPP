using System.Reflection;
using Sacou.Modules.Groups.ListMemberLevels;
using Sacou.Modules.Groups.ListMembers;
using Sacou.Modules.Groups.SetMemberLevels;
using Sacou.Modules.Identity;
using Xunit;

namespace Sacou.Modules.Groups.Tests.ListMembers;

/// <summary>P1 of E3.17 (ADR 0051, D7): the member list is the same body for every role, and it has no level.</summary>
public sealed class MemberResponseTests
{
    private const string LevelWord = "Level";
    private const string ResponseSuffix = "Response";
    private const string AdminLevelWord = "AdminLevel";
    private const string SuggestedLevelWord = "SuggestedLevel";
    private const string MyProfileResponseName = "Sacou.Modules.Identity.GetMyProfile.MyProfileResponse";

    /// <summary>The answers of the admin's level routes (ADR 0051, D7): the only ones of the Groups module that name a level, reviewed by hand.</summary>
    private static readonly Type[] LevelResponses = [typeof(MemberLevelResponse), typeof(MemberLevelSetResponse)];

    [Fact]
    public void MemberResponse_HasExactlyItsNineFields()
    {
        Assert.Equal(
            ["HasAccount", "IsMe", "JoinedAt", "MemberId", "MemberType", "Nickname", "OtherPositions", "PrimaryPosition", "Role"],
            typeof(MemberResponse).GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(property => property.Name).Order(StringComparer.Ordinal));
    }

    /// <summary>No answer of the Groups module names a level, but the two of the admin's level routes, a reviewed exception.</summary>
    [Fact]
    public void NoGroupsResponse_HasALevelProperty()
    {
        var responses = typeof(GroupsModule).Assembly.GetTypes()
            .Where(type => type.Name.EndsWith(ResponseSuffix, StringComparison.Ordinal) && !LevelResponses.Contains(type))
            .ToList();

        Assert.Contains(typeof(MemberResponse), responses);
        Assert.All(responses, type => Assert.DoesNotContain(
            type.GetProperties(BindingFlags.Public | BindingFlags.Instance),
            property => property.Name.Contains(LevelWord, StringComparison.OrdinalIgnoreCase)));
    }

    /// <summary>
    /// Plan E3.17, P2: the admin's level and the suggestion of someone else leave only through the level routes.
    /// Across Groups and Identity, no other answer has a property named for either; the person's own profile is the
    /// one exception for the suggestion (their own).
    /// </summary>
    [Fact]
    public void OnlyTheLevelRoutes_AnswerAnAdminLevelOrASuggestion()
    {
        var myProfile = typeof(IdentityModule).Assembly.GetType(MyProfileResponseName, throwOnError: true)!;
        var offenders = new[] { typeof(GroupsModule).Assembly, typeof(IdentityModule).Assembly }
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type => type.Name.EndsWith(ResponseSuffix, StringComparison.Ordinal) && !LevelResponses.Contains(type))
            .SelectMany(type => type.GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(property => (type, property.Name)))
            .Where(pair => pair.Name.Contains(AdminLevelWord, StringComparison.OrdinalIgnoreCase)
                || (pair.Name.Contains(SuggestedLevelWord, StringComparison.OrdinalIgnoreCase) && pair.type != myProfile))
            .Select(pair => $"{pair.type.FullName}.{pair.Name}");

        Assert.Empty(offenders);
        Assert.Contains(myProfile.GetProperties(), property => property.Name == SuggestedLevelWord);
    }

    /// <summary>The level answers never carry the author nor the time of the level (minimization, plan E3.17 section 3).</summary>
    [Fact]
    public void LevelResponses_HaveExactlyTheirFields()
    {
        Assert.Equal(["AdminLevel", "MemberId", "Reviewed", "SuggestedLevel"], FieldsOf(typeof(MemberLevelResponse)));
        Assert.Equal(["AdminLevel", "MemberId", "Reviewed"], FieldsOf(typeof(MemberLevelSetResponse)));
    }

    private static IEnumerable<string> FieldsOf(Type type) =>
        type.GetProperties(BindingFlags.Public | BindingFlags.Instance).Select(property => property.Name).Order(StringComparer.Ordinal);
}
