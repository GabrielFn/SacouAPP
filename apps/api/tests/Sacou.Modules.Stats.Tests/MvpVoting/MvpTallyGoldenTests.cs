using System.Text.Json;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Shared.Members;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Stats.Tests.MvpVoting;

/// <summary>
/// G1 to G8 of E3.18 (ADR 0072, D5 and D6), from <c>mvp-tally-cases.json</c>. Only C#: the app never counts the votes;
/// the shared golden of the MVP by the data is the <c>round-summary.json</c> of the E3.9.
/// </summary>
public sealed class MvpTallyGoldenTests
{
    private static readonly string[] GoldenIds =
    [
        "G1-most-votes",
        "G2-tie-by-balance",
        "G3-tie-by-wins",
        "G4-shared",
        "G5-no-votes",
        "G6-candidate-corrected-out",
        "G6b-candidate-gone",
        "G7-voter-corrected-out",
        "G8-negative-balance",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("mvp-tally-cases.json");

    private static readonly DateTimeOffset CastAt = new(2026, 11, 21, 2, 0, 0, TimeSpan.Zero);

    public static TheoryData<string> CaseIds => new(GoldenIds);

    [Fact]
    public void EveryCaseOfTheFile_IsListed() =>
        GoldenFile.AssertListMatchesFile(GoldenIds, [.. Cases.Select(GoldenFile.IdOf)]);

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void Count_MatchesTheGolden(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var players = goldenCase.GetProperty("players").EnumerateArray().Select(player => new MvpCandidate(
            Member(player, "memberId"),
            player.GetProperty("matchesPlayed").GetInt32(),
            player.GetProperty("wins").GetInt32(),
            player.GetProperty("plusMinus").GetInt32()));
        var votes = goldenCase.GetProperty("votes").EnumerateArray()
            .Select(vote => new MvpVote(Member(vote, "voter"), Member(vote, "candidate"), CastAt))
            .ToList();
        var expected = goldenCase.GetProperty("expected");

        var result = MvpTally.Count(votes, players);

        Assert.Equal(expected.GetProperty("winners").EnumerateArray().Select(winner => new MemberId(winner.GetGuid())), result.Winners);
        Assert.Equal(expected.GetProperty("voters").GetInt32(), result.Voters);
    }

    private static MemberId Member(JsonElement record, string field) => new(Guid.Parse(GoldenFile.Text(record, field)));
}
