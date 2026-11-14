using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Draw;
using Xunit;
using static Sacou.Modules.Sessions.Tests.Draw.DrawFixture;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>
/// Levels in whole points make every sum a multiple of ten tenths, so the local search may stop at the gap of one
/// divisor. These cases catch a stop that is too early (a gap of two divisors) by comparing with the brute force.
/// </summary>
public sealed class TeamDrawCoarseLevelsTests
{
    private const int Cases = 100;
    private const int WholePoint = 10;
    private const int WholePointSteps = 5;
    private const ulong GeneratorSeed = 0xC0A5;

    [Theory]
    [InlineData(12, 4)]
    [InlineData(9, 3)]
    [InlineData(12, 3)]
    public void LocalSearch_WithWholePointLevels_ReachesTheOracleGap(int playerCount, int perTeam)
    {
        var generator = new SeededRandom(GeneratorSeed + (ulong)playerCount);
        for (var index = 0; index < Cases; index++)
        {
            ImmutableArray<DrawPlayer> players = Players(
                [.. Enumerable.Range(0, playerCount).Select(_ => WholePoint * (1 + generator.NextBelow(WholePointSteps)))]);
            var layout = TeamLayout.For(playerCount, perTeam).Value;
            var result = TeamDraw.Run(Input(players, perTeam, [], seed: generator.NextUInt64()));
            var expected = DrawOracle.BestSumGap(players[..layout.PlayingCount], [], layout.TeamCount, layout.TeamSize);

            Assert.True(result.IsSuccess);
            Assert.True(expected == SumGap(result.Value),
                $"oracle {expected}, draw {SumGap(result.Value)}: levels [{string.Join(",", players.Select(player => player.LevelTenths))}]");
        }
    }
}
