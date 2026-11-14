using System.Collections.Immutable;
using System.Diagnostics;
using Sacou.Modules.Sessions.Domain.Draw;
using Xunit;
using static Sacou.Modules.Sessions.Tests.Draw.DrawFixture;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>Properties of the draw against the brute force of <see cref="DrawOracle"/> (plan E3.6, section 4).</summary>
public sealed class TeamDrawOracleTests
{
    private const int TwoTeamCases = 500;
    private const int ThreeTeamCases = 200;
    private const int MaxLocksPerCase = 3;
    private const int LevelSteps = 9;
    private const int MaxPlayersOnTwoTeams = 16;
    private const ulong GeneratorSeed = 0x5AC0;
    private const int VarietySeeds = 20;
    private const int TimeLimitMilliseconds = 200;
    private const int TimedRuns = 5;

    [Fact]
    public void TwoTeams_AlwaysMatchTheOracle()
    {
        var generator = new SeededRandom(GeneratorSeed);
        var checkedCases = 0;
        while (checkedCases < TwoTeamCases)
        {
            var perTeam = 2 + generator.NextBelow(7);
            var extra = generator.NextBelow(Math.Min(perTeam - 1, MaxPlayersOnTwoTeams + 1 - (2 * perTeam)) + 1);
            checkedCases += MatchesTheOracle(generator, (2 * perTeam) + extra, perTeam) ? 1 : 0;
        }
    }

    [Fact]
    public void ThreeTeamsOfFour_MatchTheOracleThroughTheLocalSearch()
    {
        var generator = new SeededRandom(GeneratorSeed + 1);
        var checkedCases = 0;
        while (checkedCases < ThreeTeamCases)
        {
            checkedCases += MatchesTheOracle(generator, 12, BeachFour) ? 1 : 0;
        }
    }

    [Fact]
    public void ThirtySixPlayers_NoSwapOfTwoPlayersImproves_AndItIsFast()
    {
        var generator = new SeededRandom(GeneratorSeed + 2);
        var input = Input(RandomPlayers(generator, 36), Indoor);
        var result = TeamDraw.Run(input).Value;

        // The fastest of a few runs, so a busy machine running the other test projects does not fail it.
        var fastest = Enumerable.Range(0, TimedRuns).Min(_ => ElapsedMilliseconds(input));

        Assert.Equal(6, result.Teams.Length);
        Assert.False(AnySwapImproves(result));
        Assert.True(fastest < TimeLimitMilliseconds, $"took {fastest} ms");
    }

    [Fact]
    public void SameInputAndSeed_GiveTheSameDraw_WhateverTheOrderOfThePlayers()
    {
        var generator = new SeededRandom(GeneratorSeed + 3);
        DrawInput[] inputs = [ScreenSevenInput(), Input(RandomPlayers(generator, 12), BeachFour), Input(RandomPlayers(generator, 30), Indoor)];

        Assert.All(inputs, input =>
        {
            var shuffled = input with { Players = [.. generator.Shuffle(input.Players)], Locks = [.. input.Locks.Reverse()] };
            var expected = Describe(TeamDraw.Run(input).Value);

            Assert.Equal(expected, Describe(TeamDraw.Run(input).Value));
            Assert.Equal(expected, Describe(TeamDraw.Run(shuffled).Value));
        });
    }

    [Fact]
    public void ScreenSeven_OtherSeeds_GiveOtherOptimalSplits()
    {
        var results = Enumerable.Range(1, VarietySeeds).Select(seed => TeamDraw.Run(ScreenSevenInput((ulong)seed)).Value).ToList();

        Assert.All(results, result => Assert.Equal([220, 225], Sums(result)));
        Assert.All(results, result => Assert.Equal(TeamOf(result, Named("Ana")), TeamOf(result, Named("João"))));
        Assert.True(results.Select(SplitKey).Distinct().Count() > 1);
    }

    /// <summary>False when the random locks are invalid, too large or in conflict: the case is drawn again.</summary>
    private static bool MatchesTheOracle(SeededRandom generator, int playerCount, int perTeam)
    {
        var players = RandomPlayers(generator, playerCount);
        var layout = TeamLayout.For(playerCount, perTeam).Value;
        var playing = players[..layout.PlayingCount];
        var locks = RandomLocks(generator, playing);
        var result = TeamDraw.Run(Input(players, perTeam, locks, seed: generator.NextUInt64()));
        if (result.IsFailure && result.Error != DrawErrors.LocksUnsatisfiable)
        {
            return false;
        }

        var expected = DrawOracle.BestSumGap(playing, locks, layout.TeamCount, layout.TeamSize);
        int? actual = result.IsSuccess ? SumGap(result.Value) : null;
        Assert.True(expected == actual, $"oracle {expected}, draw {actual}: levels [{string.Join(",", players.Select(player => player.LevelTenths))}], "
            + $"locks [{string.Join(", ", locks.Select(item => $"{item.First.Value.ToString()[..8]}-{item.Second.Value.ToString()[..8]} {item.Kind}"))}]"
            + (result.IsSuccess ? $", split {SplitKey(result.Value)}" : string.Empty));
        return true;
    }

    private static ImmutableArray<DrawPlayer> RandomPlayers(SeededRandom generator, int count) =>
        Players([.. Enumerable.Range(0, count).Select(_ => 10 + (5 * generator.NextBelow(LevelSteps)))]);

    private static ImmutableArray<DrawLock> RandomLocks(SeededRandom generator, ImmutableArray<DrawPlayer> playing) =>
        [.. Enumerable.Range(0, generator.NextBelow(MaxLocksPerCase + 1)).Select(_ =>
        {
            var first = generator.NextBelow(playing.Length);
            var second = (first + 1 + generator.NextBelow(playing.Length - 1)) % playing.Length;
            var kind = generator.NextBelow(2) == 0 ? DrawLockKind.Together : DrawLockKind.Apart;
            return new DrawLock(playing[first].MemberId, playing[second].MemberId, kind);
        })];

    private static bool AnySwapImproves(DrawResult result)
    {
        int[] sums = [.. result.Teams.Select(team => team.Members.Sum(player => player.LevelTenths))];
        int[] sizes = [.. result.Teams.Select(team => team.Members.Length)];
        var score = DrawScore.Of(sums, sizes);
        return (
            from first in Enumerable.Range(0, sums.Length)
            from second in Enumerable.Range(first + 1, sums.Length - first - 1)
            from left in result.Teams[first].Members
            from right in result.Teams[second].Members
            let moved = left.LevelTenths - right.LevelTenths
            select DrawScore.Of(
                [.. sums.Select((sum, team) => team == first ? sum - moved : team == second ? sum + moved : sum)], sizes))
            .Any(swapped => swapped.IsBetterThan(score));
    }

    private static long ElapsedMilliseconds(DrawInput input)
    {
        var watch = Stopwatch.StartNew();
        TeamDraw.Run(input);
        return watch.ElapsedMilliseconds;
    }

    private static string Describe(DrawResult result) =>
        $"{SplitKey(result)} / {string.Join(",", result.Reserves.Select(player => player.Sequence))} / {result.DifferenceTenths}";
}
