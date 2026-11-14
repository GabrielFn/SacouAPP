using Sacou.Modules.Sessions.Domain.Draw;
using Xunit;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>Questions 52 and 53: as many full teams as fit, else two halves; the rest wait as reserves.</summary>
public sealed class TeamLayoutTests
{
    public static readonly TheoryData<int, int, int, int, int> Layouts = new()
    {
        { 12, 6, 2, 6, 0 },
        { 13, 6, 2, 6, 1 },
        { 14, 6, 2, 6, 2 },
        { 17, 6, 2, 6, 5 },
        { 18, 6, 3, 6, 0 },
        { 36, 6, 6, 6, 0 },
        { 10, 6, 2, 5, 0 },
        { 11, 6, 2, 5, 1 },
        { 4, 6, 2, 2, 0 },
        { 5, 6, 2, 2, 1 },
        { 9, 2, 4, 2, 1 },
        { 4, 2, 2, 2, 0 },
        { 12, 4, 3, 4, 0 },
        { 7, 4, 2, 3, 1 },
    };

    [Theory]
    [MemberData(nameof(Layouts))]
    public void For_SplitsThePlayers(int players, int perTeam, int teams, int size, int reserves)
    {
        var layout = TeamLayout.For(players, perTeam);

        Assert.Equal(new TeamLayout(teams, size, reserves), layout.Value);
        Assert.Equal(players, layout.Value.PlayingCount + layout.Value.ReserveCount);
    }

    [Theory]
    [InlineData(3, 6)]
    [InlineData(3, 2)]
    [InlineData(0, 4)]
    public void For_FewerThanFour_IsNotEnough(int players, int perTeam)
    {
        Assert.Equal(DrawErrors.NotEnoughPlayers, TeamLayout.For(players, perTeam).Error);
    }
}
