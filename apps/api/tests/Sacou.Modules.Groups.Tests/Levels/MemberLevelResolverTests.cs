using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Shared.Levels;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Levels;

/// <summary>Where a resolved level came from, as a public twin for the theory rows.</summary>
public enum Origin
{
    Admin,
    Suggested,
    Default,
}

/// <summary>
/// Golden table of ADR 0051, D9 (plan E3.17, section 5), written by hand. Server side only: the rule has no TS
/// side, so the table lives here; E3.6 exports it if the draw ever runs in the app. A null admin level stands for
/// both "Não sei" (a reviewed row) and "never reviewed": the rule treats them alike, so each row says which one.
/// </summary>
public sealed class MemberLevelResolverTests
{
    public static readonly TheoryData<string, int?, int?, int, Origin> Golden = new()
    {
        { "admin 3,5, suggestion 4,0", 35, 40, 35, Origin.Admin },
        { "admin 1,0, no suggestion", 10, null, 10, Origin.Admin },
        { "admin 5,0, suggestion 1,0", 50, 10, 50, Origin.Admin },
        { "Não sei, suggestion 4,5", null, 45, 45, Origin.Suggested },
        { "Não sei, no suggestion", null, null, 30, Origin.Default },
        { "never reviewed, suggestion 2,0", null, 20, 20, Origin.Suggested },
        { "never reviewed, no suggestion", null, null, 30, Origin.Default },
        { "guest without an account (E3.5)", null, null, 30, Origin.Default },
    };

    [Theory]
    [MemberData(nameof(Golden))]
    public void Resolve_FollowsTheGoldenTable(string row, int? adminTenths, int? suggestedTenths, int expectedTenths, Origin origin)
    {
        var resolved = MemberLevelResolver.Resolve(Level(adminTenths), Level(suggestedTenths));

        Assert.True(resolved.Level.Tenths == expectedTenths, row);
        Assert.Equal(origin.ToString(), resolved.Origin.ToString());
    }

    [Fact]
    public void Default_IsThreeAsTheSharedScaleSays()
    {
        Assert.Equal(SkillLevel.DefaultTenths, MemberLevelResolver.Resolve(null, null).Level.Tenths);
    }

    private static SkillLevel? Level(int? tenths) => tenths is { } value ? SkillLevel.FromTenths(value).Value : null;
}
