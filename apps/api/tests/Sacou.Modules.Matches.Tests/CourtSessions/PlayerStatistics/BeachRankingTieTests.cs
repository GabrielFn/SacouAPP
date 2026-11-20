using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.PlayerStatistics;

/// <summary>A full tie in the sand is settled by first appearance, never by member id order.</summary>
public sealed class BeachRankingTieTests
{
    private static FinishedMatchResult Match(string id, TeamSide winner, string[] a, string[] b) =>
        new(id, winner, new BySide<ImmutableArray<string>>([.. a], [.. b]), new BySide<ImmutableArray<string>>([.. a], [.. b]), new BySide<int>(21, 21));

    [Theory]
    [InlineData("z1", "z2", "a1", "a2")]
    [InlineData("a1", "a2", "z1", "z2")]
    public void FullTie_KeepsFirstAppearanceOrder(string x1, string x2, string y1, string y2)
    {
        var ranking = BeachRanking.Of(
            [Match("m1", TeamSide.A, [x1, x2], [y1, y2]), Match("m2", TeamSide.A, [y1, y2], [x1, x2])]);

        Assert.Equal([x1, x2], ranking[0].MemberIds);
        Assert.Equal([y1, y2], ranking[1].MemberIds);
    }

    [Fact]
    public void ReorderedMembers_AreTheSameTeam_AndKeepTheFirstOrder()
    {
        var ranking = BeachRanking.Of(
            [Match("m1", TeamSide.A, ["b", "a"], ["c", "d"]), Match("m2", TeamSide.A, ["a", "b"], ["c", "d"])]);

        Assert.Equal(2, ranking.Length);
        Assert.Equal(["b", "a"], ranking[0].MemberIds);
        Assert.Equal(2, ranking[0].Wins);
    }
}
