using System.Text.Json;
using Sacou.Modules.Sessions.Domain.Draw;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>
/// The meter of screen 07, shared with the app (ADR 0055, D7): <c>packages/volley-rules/golden/draw-balance.json</c>.
/// The TS runner comes with E4.7.
/// </summary>
public sealed class DrawBalanceGoldenTests
{
    private const int GoldenCaseCount = 5;

    private static readonly string[] GoldenIds =
    [
        "screen-07-two-teams",
        "half-up-35.5",
        "three-teams-highest-minus-lowest",
        "exact-36.4-and-35.6-round-equal",
        "equal-teams",
    ];

    private static readonly HashSet<string> CaseFields = ["id", "source", "teamsLevelsTenths", "expected"];
    private static readonly HashSet<string> ExpectedFields = ["averagesTenths", "differenceTenths"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("draw-balance.json");

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
    public void Meter_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        GoldenFile.Text(goldenCase, "source");
        var expected = goldenCase.GetProperty("expected");
        GoldenFile.AssertOnlyFields(expected, ExpectedFields, id);
        int[][] teams = [.. goldenCase.GetProperty("teamsLevelsTenths").EnumerateArray().Select(team => Integers(team, id))];

        int[] averages = [.. teams.Select(team => DrawBalance.AverageTenths(team))];

        Assert.Equal(Integers(expected.GetProperty("averagesTenths"), id), averages);
        Assert.Equal(Whole(expected.GetProperty("differenceTenths"), id), DrawBalance.DifferenceTenths(averages));
    }

    private static int[] Integers(JsonElement array, string id) => [.. array.EnumerateArray().Select(value => Whole(value, id))];

    private static int Whole(JsonElement value, string id)
    {
        var number = GoldenFile.Number(value, id);
        Assert.True(number == Math.Floor(number), $"{id}: expected a whole number.");
        return (int)number;
    }
}
