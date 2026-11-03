using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>What the golden file does not spell out: the value objects and the edges of the series.</summary>
public sealed class ScoreRulesTests
{
    [Theory]
    [InlineData(1, 1)]
    [InlineData(3, 2)]
    [InlineData(5, 3)]
    public void SetsToWin_IsHalfRoundedUp(int bestOf, int expected)
    {
        Assert.Equal(expected, ScoreRules.SetsToWin(bestOf));
    }

    [Fact]
    public void TieBreak_IsOnlyTheDecidingSet_AndOffWithNull()
    {
        var withTieBreak = new ScoringRules(BestOf: 3, PointsPerSet: 25, TieBreakPoints: 15, WinMargin: 2);

        Assert.Equal(25, ScoreRules.TargetPointsForSet(withTieBreak, 2));
        Assert.Equal(15, ScoreRules.TargetPointsForSet(withTieBreak, 3));
        Assert.Equal(25, ScoreRules.TargetPointsForSet(withTieBreak with { TieBreakPoints = null }, 3));
        Assert.Equal(25, ScoreRules.TargetPointsForSet(withTieBreak with { BestOf = 1 }, 1));
    }

    [Fact]
    public void SetPointTeams_ListsATeamFirst_WhenBothHaveIt()
    {
        Assert.Equal([TeamSide.A, TeamSide.B], ScoreRules.GetSetPointTeams(new BySide<int>(24, 24), 25, 1));
    }

    [Fact]
    public void Sides_AreOpposite_AndPairsReadBySide()
    {
        var pair = new BySide<int>(1, 2);

        Assert.Equal(TeamSide.B, TeamSide.A.Opponent());
        Assert.Equal(TeamSide.A, TeamSide.B.Opponent());
        Assert.Equal(2, pair.Of(TeamSide.B));
        Assert.Equal(new BySide<int>(1, 5), pair.With(TeamSide.B, 5));
        // The opponent is a method, so printing a side ends.
        Assert.Equal("TeamSide { Code = a }", TeamSide.A.ToString());
    }
}
