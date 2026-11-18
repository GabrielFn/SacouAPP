using System.Text.Json;
using Sacou.Modules.Sessions.Domain.Draw;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>
/// The split in teams and reserves, shared with the app's "Montar times" (E4.7, question 72):
/// <c>packages/volley-rules/golden/draw-split.json</c>. Players are named by their order of arrival (1..n). The
/// server shuffles who plays where, so only the sizes and the reserves (the last ones to arrive) are checked here;
/// the TS runner also checks the teams by arrival.
/// </summary>
public sealed class DrawSplitGoldenTests
{
    private const int GoldenCaseCount = 13;
    private const string ErrorPrefix = "sessions.draw-";

    private static readonly string[] GoldenIds =
    [
        "fourteen-indoor",
        "twelve-indoor",
        "thirteen-indoor",
        "seventeen-indoor",
        "eighteen-indoor",
        "ten-indoor-halves",
        "eleven-indoor-halves",
        "four-indoor-halves",
        "five-indoor-halves",
        "nine-beach-pairs",
        "twelve-beach-fours",
        "seven-beach-fours-halves",
        "three-not-enough",
    ];

    private static readonly HashSet<string> CaseFields = ["id", "source", "playerCount", "playersPerTeam", "expected"];
    private static readonly HashSet<string> SplitFields = ["teams", "reserves"];
    private static readonly HashSet<string> ErrorFields = ["error"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("draw-split.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    [Fact]
    public void GoldenList_HasTheExactTotal()
    {
        Assert.Equal(GoldenCaseCount, GoldenIds.Length);
    }

    [Fact]
    public void GoldenList_MatchesTheFile()
    {
        GoldenFile.AssertListMatchesFile(GoldenIds, [.. Cases.Select(GoldenFile.IdOf)]);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void Draw_SplitsAsTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        GoldenFile.Text(goldenCase, "source");
        var playerCount = Whole(goldenCase.GetProperty("playerCount"), id);
        var playersPerTeam = Whole(goldenCase.GetProperty("playersPerTeam"), id);
        var expected = goldenCase.GetProperty("expected");
        var players = DrawFixture.Players([.. Enumerable.Repeat(DrawFixture.DefaultLevel, playerCount)]);

        var draw = TeamDraw.Run(DrawFixture.Input(players, playersPerTeam, balance: false));

        if (expected.TryGetProperty("error", out var error))
        {
            GoldenFile.AssertOnlyFields(expected, ErrorFields, id);
            Assert.Equal(ErrorPrefix + error.GetString(), draw.Error.Code);
            return;
        }

        GoldenFile.AssertOnlyFields(expected, SplitFields, id);
        int[][] teams = [.. expected.GetProperty("teams").EnumerateArray().Select(team => Integers(team, id))];
        Assert.Equal(teams.Length, draw.Value.Teams.Length);
        Assert.All(teams, team => Assert.Equal(team.Length, draw.Value.TeamSize));
        Assert.All(draw.Value.Teams, team => Assert.Equal(draw.Value.TeamSize, team.Members.Length));
        int[] reserves = [.. draw.Value.Reserves.Select(player => player.Sequence)];
        Assert.Equal(Integers(expected.GetProperty("reserves"), id), reserves);
    }

    private static int[] Integers(JsonElement array, string id) => [.. array.EnumerateArray().Select(value => Whole(value, id))];

    private static int Whole(JsonElement value, string id)
    {
        var number = GoldenFile.Number(value, id);
        Assert.True(number == Math.Floor(number), $"{id}: expected a whole number.");
        return (int)number;
    }
}
