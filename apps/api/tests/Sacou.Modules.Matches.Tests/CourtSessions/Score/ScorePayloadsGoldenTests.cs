using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the "score payloads golden" of <c>score.golden.test.ts</c>, reading the same file.</summary>
public sealed class ScorePayloadsGoldenTests
{
    private const int GoldenCaseCount = 865;

    private static readonly string[] GoldenIds = [.. ScorePayloadGoldenIds.All];

    private static readonly string[] ForbiddenNames = ["email", "name", "nickname", "phone", "pix", "photo", "userId"];
    private static readonly string[] StrangeKeys = ["__proto__", "constructor", "1"];

    private static readonly HashSet<string> CaseFields = ["id", "type", "payload", "expected"];
    private static readonly HashSet<string> ExpectedFields = ["ok", "field"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("score-payloads.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    public static TheoryData<string> SchemaTypes => new(PayloadSchemas.All.Select(schema => schema.Type));

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
    public void Parser_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var expected = goldenCase.GetProperty("expected");
        GoldenFile.AssertOnlyFields(expected, ExpectedFields, id);
        var payload = goldenCase.GetProperty("payload");

        var parsed = ScorePayloadParser.Parse(GoldenFile.Text(goldenCase, "type"), RawValueReader.Parse(payload.GetRawText()));

        if (expected.GetProperty("ok").GetBoolean())
        {
            Assert.True(parsed.IsSuccess, $"{id}: expected a valid payload, got {parsed}.");
            OrderedJsonAssert.EqualIgnoringKeyOrder(payload, writer => ScorePayloadJson.Write(writer, parsed.Value), id);
            return;
        }

        Assert.True(parsed.IsFailure, $"{id}: expected an invalid payload.");
        Assert.Equal(PayloadError.InvalidPayloadCode, parsed.Error.Code);
        Assert.Equal(GoldenFile.Text(expected, "field"), parsed.Error.Field);
    }

    [Theory]
    [MemberData(nameof(SchemaTypes))]
    public void EverySchema_HasAValidMinimum_AndACaseForEachMissingField(string type)
    {
        var schema = PayloadSchemas.All.Single(candidate => candidate.Type == type);

        Assert.Contains($"{type}-valid", GoldenIds);
        Assert.All(schema.Fields, field => Assert.Contains($"{type}-missing-{field}", GoldenIds));
    }

    [Theory]
    [MemberData(nameof(SchemaTypes))]
    public void EverySchema_HasACaseForEachForbiddenNameAndStrangeKey_AtEachLevel(string type)
    {
        var schema = PayloadSchemas.All.Single(candidate => candidate.Type == type);

        Assert.All(schema.Levels, level =>
        {
            Assert.All(ForbiddenNames, name => Assert.Contains($"{type}-forbidden-{name}-at-{level}", GoldenIds));
            Assert.All(StrangeKeys, key => Assert.Contains($"{type}-key-{key}-at-{level}", GoldenIds));
        });
        Assert.All(StrangeKeys, key =>
        {
            var payload = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, $"{type}-key-{key}-at-root").GetProperty("payload");
            Assert.Contains(payload.EnumerateObject(), member => member.Name == key);
        });
    }
}
