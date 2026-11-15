using System.Globalization;
using Sacou.Modules.Sessions.Domain.Draw;
using Sacou.Modules.Sessions.DrawTeams;
using Xunit;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>The levels are private (ADR 0055): no draw value, nor the route's answer, prints a level, a sum or an average, so none reaches a log.</summary>
public sealed class DrawPrintingTests
{
    private const int Level = 45;

    public static TheoryData<object, string> Values()
    {
        var player = new DrawPlayer(DrawFixture.Member(1), Level, 1);
        var result = TeamDraw.Run(DrawFixture.ScreenSevenInput()).Value;
        return new TheoryData<object, string>
        {
            { player, nameof(DrawPlayer) },
            { result.Teams[0], nameof(DrawnTeam) },
            { result, nameof(DrawResult) },
            { DrawFixture.ScreenSevenInput(), nameof(DrawInput) },
            { DrawScore.Of([Level, Level + 1], [1, 1]), nameof(DrawScore) },
            { new DrawUnit([player]), nameof(DrawUnit) },
            { DrawTeamsResponse.From(result), nameof(DrawTeamsResponse) },
            { DrawnTeamResponse.From(result.Teams[0]), nameof(DrawnTeamResponse) },
            { DrawnPlayerResponse.From(player), nameof(DrawnPlayerResponse) },
            { new DrawTeamsRequest(null, null), nameof(DrawTeamsRequest) },
        };
    }

    [Theory]
    [MemberData(nameof(Values))]
    public void ToString_IsTheTypeName_WithoutLevels(object value, string expected)
    {
        var printed = value.ToString();

        Assert.Equal(expected, printed);
        Assert.DoesNotContain(Level.ToString(CultureInfo.InvariantCulture), printed, StringComparison.Ordinal);
    }
}
