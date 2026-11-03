using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>What only C# can get wrong in the payload parsers, beyond the golden file (ADR 0033).</summary>
[SuppressMessage("Security", "CA5394:Do not use insecure randomness", Justification = "A fixed seed makes the fuzz repeatable; nothing here is secret.")]
public sealed class ScorePayloadParserTests
{
    private const string Canary = "CANARY-fictional.player@example.com";
    private const int Seed = 20_261_104;
    private const int MutationsPerType = 200;
    private const int ItemsOverTheBudget = 5_000;
    private const string HugeExponent = "1e99999999999";

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("score-payloads.json");

    private static readonly string[] HostileValues =
    [
        HugeExponent,
        "-" + HugeExponent,
        "2.5",
        "-1",
        "0",
        "-0",
        "9007199254740992",
        "null",
        "true",
        "[]",
        "{}",
        $"\"{Canary}\"",
        $$"""{"{{Canary}}":"{{Canary}}"}""",
        $"[{string.Join(",", Enumerable.Repeat("0", ItemsOverTheBudget))}]",
        $"[{string.Join(",", Enumerable.Repeat($"\"{Canary}\"", ItemsOverTheBudget))}]",
        $"\"{EnvelopeJson.UnicodeEscape(0xD800)}\"",
    ];

    public static TheoryData<string> Types => new(ScoreEventTypes.All);

    [Fact]
    public void FractionalLiberoIndex_IsRefused_AndAnIntegralDoubleIsAccepted()
    {
        var withFraction = WithLibero("[2.5]");
        var withIntegralDoubles = WithLibero("[2.0, 5e0]");

        Assert.Equal("rotations.a.libero", Parse(ScoreEventTypes.MatchStarted, withFraction).Error.Field);
        var parsed = Assert.IsType<MatchStartedPayload>(Parse(ScoreEventTypes.MatchStarted, withIntegralDoubles).Value);
        Assert.Equal([2, 5], parsed.Rotations.A!.Libero!.ReplacedIndexes);
    }

    [Fact]
    public void FractionalLiberoIndex_IsRefused_InALineupChange()
    {
        var payload = Payload("LineupChanged-valid");
        payload["libero"] = JsonNode.Parse("""{"memberId":"a0000000-0000-4000-8000-000000000099","replacedIndexes":[1.5]}""");

        Assert.Equal(PayloadFields.Libero, Parse(ScoreEventTypes.LineupChanged, payload.ToJsonString()).Error.Field);
    }

    /// <summary>
    /// JSON text never yields NaN in .NET 10: a huge exponent reads as Infinity. Both the text and a
    /// NaN built in code are refused, by the envelope and by the payload.
    /// </summary>
    [Fact]
    public void NumberThatDoesNotFitADouble_IsRefused_EndToEnd()
    {
        var payload = Payload("PointScored-valid");
        payload["setNumber"] = JsonNode.Parse(HugeExponent);
        var nanPayload = new RawObject([.. Assert.IsType<RawObject>(RawValueReader.Parse(Payload("PointScored-valid").ToJsonString())).Members
            .Select(member => member.Key == PayloadFields.SetNumber ? member with { Value = new RawNumber(double.NaN) } : member)]);

        Assert.Equal(PayloadFields.SetNumber, Parse(ScoreEventTypes.PointScored, payload.ToJsonString()).Error.Field);
        Assert.Equal(PayloadFields.SetNumber, ScorePayloadParser.Parse(ScoreEventTypes.PointScored, nanPayload).Error.Field);
        EnvelopeJson.AssertInvalid(EnvelopeJson.With(EnvelopeFields.Batch, HugeExponent), EnvelopeFields.Batch);
        var nanBatch = new RawObject([.. Assert.IsType<RawObject>(RawValueReader.Parse(EnvelopeJson.Valid())).Members
            .Select(member => member.Key == EnvelopeFields.Batch ? member with { Value = new RawNumber(double.NaN) } : member)]);
        Assert.Equal(EnvelopeFields.Batch, EnvelopeParser.Parse(nanBatch).Error.Field);
        Assert.Null(PayloadCopier.Copy(EnvelopeJson.ValuePayload(new RawNumber(double.NaN))));
    }

    [Theory]
    [MemberData(nameof(Types))]
    public void ValidPayload_IsParsed_InAnyCulture(string type)
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("pt-BR");

            Assert.True(Parse(type, Payload($"{type}-valid").ToJsonString()).IsSuccess);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Theory]
    [InlineData("RevertedTo")]
    [InlineData("matchStarted")]
    [InlineData("")]
    public void TypeOutsideTheCatalog_HasNoValidPayload(string type)
    {
        Assert.Equal(PayloadFields.Root, Parse(type, Payload("PointScored-valid").ToJsonString()).Error.Field);
    }

    [Fact]
    public void RepeatedKey_IsAnUnknownField_AtEveryLevel()
    {
        var root = """{"matchId":"f0000000-0000-4000-8000-000000000001","matchId":"f0000000-0000-4000-8000-000000000001","setNumber":1,"team":"a"}""";
        var nested = Payload("QueueChanged-valid").ToJsonString().Replace("\"players\":", "\"players\":[],\"players\":", StringComparison.Ordinal);

        Assert.Equal(PayloadFields.UnknownField, Parse(ScoreEventTypes.PointScored, root).Error.Field);
        Assert.Equal(PayloadFields.UnknownField, Parse(ScoreEventTypes.QueueChanged, nested).Error.Field);
    }

    /// <summary>A canary in every leaf and every list item of every type, and as a key at every level.</summary>
    [Theory]
    [MemberData(nameof(Types))]
    public void Error_NeverCarriesTheReceivedValue(string type)
    {
        var valid = Payload($"{type}-valid");
        var mutations = LeafPaths(valid).Select(path => Replace(valid, path, JsonValue.Create(Canary)))
            .Concat(ObjectPaths(valid).Select(path => AddKey(valid, path)))
            .ToList();

        Assert.NotEmpty(mutations);
        Assert.All(mutations, mutated =>
        {
            var parsed = Parse(type, mutated.ToJsonString());
            Assert.True(parsed.IsFailure);
            Assert.DoesNotContain(Canary, parsed.ToString(), StringComparison.Ordinal);
        });
    }

    [Theory]
    [MemberData(nameof(Types))]
    public void MutatedPayloads_NeverThrow_AndNeverEcho(string type)
    {
        var random = new Random(Seed);
        var valid = Payload($"{type}-valid");
        var paths = LeafPaths(valid).Concat(ObjectPaths(valid)).ToList();

        for (var mutation = 0; mutation < MutationsPerType; mutation++)
        {
            var path = paths[random.Next(paths.Count)];
            var hostile = HostileValues[random.Next(HostileValues.Length)];
            // JsonNode cannot write a lone surrogate, so the value goes in as text after writing.
            var text = Replace(valid, path, JsonValue.Create(Placeholder)).ToJsonString()
                .Replace($"\"{Placeholder}\"", hostile, StringComparison.Ordinal);

            var parsed = Parse(type, text);

            Assert.DoesNotContain(Canary, parsed.ToString(), StringComparison.Ordinal);
        }
    }

    private const string Placeholder = "HOSTILE-VALUE-PLACEHOLDER";

    private static Result<ScorePayload, PayloadError> Parse(string type, string json) =>
        ScorePayloadParser.Parse(type, RawValueReader.Parse(json));

    private static JsonObject Payload(string id) =>
        JsonNode.Parse(GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id).GetProperty("payload").GetRawText())!.AsObject();

    private static string WithLibero(string replacedIndexes)
    {
        var payload = Payload("MatchStarted-valid");
        var teamA = payload["teams"]!["a"]!["memberIds"]!.AsArray();
        teamA.Add("a0000000-0000-4000-8000-000000000007");
        payload["rotations"]!["a"]!["libero"] = JsonNode.Parse(
            $$"""{"memberId":"a0000000-0000-4000-8000-000000000007","replacedIndexes":{{replacedIndexes}}}""");
        return payload.ToJsonString();
    }

    /// <summary>Paths to every value that is not an object, list items included, as keys and indexes.</summary>
    private static IEnumerable<IReadOnlyList<object>> LeafPaths(JsonNode? node, IReadOnlyList<object>? prefix = null)
    {
        prefix ??= [];
        return node switch
        {
            JsonObject record => record.SelectMany(member => LeafPaths(member.Value, [.. prefix, member.Key])),
            JsonArray items => items.Count == 0
                ? [prefix]
                : [prefix, .. items.SelectMany((item, index) => LeafPaths(item, [.. prefix, index]))],
            _ => [prefix],
        };
    }

    private static IEnumerable<IReadOnlyList<object>> ObjectPaths(JsonNode? node, IReadOnlyList<object>? prefix = null)
    {
        prefix ??= [];
        return node switch
        {
            JsonObject record => [prefix, .. record.SelectMany(member => ObjectPaths(member.Value, [.. prefix, member.Key]))],
            JsonArray items => items.SelectMany((item, index) => ObjectPaths(item, [.. prefix, index])),
            _ => [],
        };
    }

    private static JsonNode Replace(JsonNode root, IReadOnlyList<object> path, JsonNode? value)
    {
        var copy = root.DeepClone();
        if (path.Count == 0)
        {
            return value ?? JsonValue.Create(Canary);
        }

        var parent = path.Take(path.Count - 1).Aggregate(copy, (node, step) => step is int index ? node[index]! : node[(string)step]!);
        if (path[^1] is int last)
        {
            parent.AsArray()[last] = value;
        }
        else
        {
            parent.AsObject()[(string)path[^1]] = value;
        }

        return copy;
    }

    private static JsonNode AddKey(JsonNode root, IReadOnlyList<object> path)
    {
        var copy = root.DeepClone();
        var target = path.Aggregate(copy, (node, step) => step is int index ? node[index]! : node[(string)step]!);
        target.AsObject()[Canary] = Canary;
        return copy;
    }
}
