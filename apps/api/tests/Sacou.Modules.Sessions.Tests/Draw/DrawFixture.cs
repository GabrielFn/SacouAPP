using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Draw;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>Builders for the draw tests. A player's sequence is its position in the list, from 1.</summary>
internal static class DrawFixture
{
    public const int Indoor = 6;
    public const int BeachFour = 4;
    public const int BeachTwo = 2;
    public const ulong Seed = 20261114;

    /// <summary>3,0: the level of a member nobody rated (ADR 0047).</summary>
    public const int DefaultLevel = 30;

    /// <summary>Screen 07 (G1): 14 confirmed in order of arrival, levels in tenths.</summary>
    public static readonly (string Name, int Level)[] ScreenSeven =
    [
        ("Ana", 40), ("João", 40), ("Pedro", 45), ("Lia", 35), ("Marcos", 30), ("Bia", 35), ("Rafa", 40),
        ("Duda", 35), ("Caio", 40), ("Nina", 35), ("Léo", 30), ("Gabi", 40), ("Davi", 35), ("Sofia", 30),
    ];

    public static MemberId Member(int sequence) => new(new Guid(sequence, 0, 0, [0, 0, 0, 0, 0, 0, 0, 2]));

    public static ImmutableArray<DrawPlayer> Players(params int[] levels) =>
        [.. levels.Select((level, position) => new DrawPlayer(Member(position + 1), level, position + 1))];

    public static ImmutableArray<DrawPlayer> ScreenSevenPlayers() => Players([.. ScreenSeven.Select(player => player.Level)]);

    public static MemberId Named(string name) => Member(Array.FindIndex(ScreenSeven, player => player.Name == name) + 1);

    public static DrawLock Together(MemberId first, MemberId second) => new(first, second, DrawLockKind.Together);

    public static DrawLock Apart(MemberId first, MemberId second) => new(first, second, DrawLockKind.Apart);

    public static DrawInput Input(
        ImmutableArray<DrawPlayer> players,
        int playersPerTeam,
        ImmutableArray<DrawLock>? locks = null,
        ImmutableArray<MemberId>? reserves = null,
        bool balance = true,
        ulong seed = Seed) => new(players, playersPerTeam, locks ?? [], reserves, balance, seed);

    public static DrawInput ScreenSevenInput(ulong seed = Seed, bool balance = true, ImmutableArray<MemberId>? reserves = null) =>
        Input(ScreenSevenPlayers(), Indoor, [Together(Named("Ana"), Named("João"))], reserves, balance, seed);

    public static int[] Sums(DrawResult result) =>
        [.. result.Teams.Select(team => team.Members.Sum(player => player.LevelTenths)).Order()];

    public static int SumGap(DrawResult result) => Sums(result).Max() - Sums(result).Min();

    public static int TeamOf(DrawResult result, MemberId member) =>
        result.Teams.Single(team => team.Members.Any(player => player.MemberId == member)).Number;

    /// <summary>The split as a set of teams, each a set of members, to compare splits whatever the numbering.</summary>
    public static string SplitKey(DrawResult result) =>
        string.Join(" | ", result.Teams
            .Select(team => string.Join(",", team.Members.Select(player => player.Sequence).Order()))
            .Order(StringComparer.Ordinal));
}
