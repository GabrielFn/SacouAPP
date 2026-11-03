using Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.PlayerStatistics;

/// <summary>The edges of the streaks that the golden file shows only in passing (ADR 0032).</summary>
public sealed class StatisticsRulesTests
{
    [Fact]
    public void WinStreaks_AreBrokenByALoss_AndByAMatchWithoutAWinner()
    {
        var win = MatchResult.Win;

        var streaks = StatisticsRules.GetWinStreaks([win, win, MatchResult.Undecided, win, MatchResult.Loss, win]);

        Assert.Equal(new WinStreaks(2, 1), streaks);
    }

    [Fact]
    public void WinStreaks_OfNoMatch_AreZero()
    {
        Assert.Equal(WinStreaks.None, StatisticsRules.GetWinStreaks([]));
    }

    [Fact]
    public void PointsByKind_CreditsOnlyTheKindAndAddsUp()
    {
        var points = PointsByKind.None.Credit(Domain.CourtSessions.Score.PointKind.Ace).Credit(Domain.CourtSessions.Score.PointKind.Attack);

        Assert.Equal(new PointsByKind(1, 0, 1, 0), points);
        Assert.Equal(new PointsByKind(2, 0, 2, 0), points.Add(points));
    }
}
