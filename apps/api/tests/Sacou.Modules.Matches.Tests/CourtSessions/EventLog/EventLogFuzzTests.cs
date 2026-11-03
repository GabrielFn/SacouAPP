using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Nodes;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.EventLog;

/// <summary>
/// Mutates the accepted golden logs with a fixed seed: hostile input must never throw and never come
/// back in an error (ADR 0033, D11). The TypeScript port turns an exception into a rejection; here an
/// exception fails the test.
/// </summary>
[SuppressMessage("Security", "CA5394:Do not use insecure randomness", Justification = "A fixed seed makes the fuzz repeatable; nothing here is secret.")]
public sealed class EventLogFuzzTests
{
    private const int Seed = 20_261_103;
    private const int MutationsPerCase = 30;
    private const int ItemsOverTheBudget = 5_000;
    private const int LevelsOverTheLimit = 40;
    private const int CanaryRepeats = 100;
    private const string Canary = "CANARY-fictional.player@example.com";
    private const string PlaceholderText = "HOSTILE-VALUE-PLACEHOLDER";
    private const string QuotedPlaceholder = "\"" + PlaceholderText + "\"";

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("event-log.json");

    private static readonly string[] HostileValues =
    [
        "1e400",
        "-1e400",
        "-1",
        "0",
        "-0",
        "0.5",
        "9007199254740992",
        "null",
        "true",
        "[]",
        "{}",
        $"\"{Canary}\"",
        $$"""{"{{Canary}}":"{{Canary}}"}""",
        $"[{string.Join(",", Enumerable.Repeat("0", ItemsOverTheBudget))}]",
        string.Concat(Enumerable.Repeat("[", LevelsOverTheLimit)) + string.Concat(Enumerable.Repeat("]", LevelsOverTheLimit)),
        $"\"{EnvelopeJson.UnicodeEscape(0xD800)}\"",
        $"\"{string.Concat(Enumerable.Repeat(Canary, CanaryRepeats))}\"",
    ];

    private delegate void Mutation(JsonObject envelope, Random random);

    private static readonly Mutation[] Mutations =
    [
        SetField,
        RemoveField,
        AddUnknownField,
        SetPayloadValue,
        AddPayloadKey,
    ];

    [Fact]
    public void MutatedLogs_NeverThrow_AndNeverEchoTheInput()
    {
        var random = new Random(Seed);
        var runs = 0;
        var rejected = 0;

        foreach (var goldenCase in Cases.Where(IsAccepted))
        {
            var rawEvents = EventLogGoldenTests.RawEventsOf(goldenCase);
            var config = AppendFixture.Config(GoldenFile.Text(goldenCase, "courtSessionId"));
            for (var mutation = 0; mutation < MutationsPerCase; mutation++)
            {
                var mutated = Mutate(rawEvents, random);

                var outcome = EventLogPipeline.Run(config, mutated);

                AssertNoEcho(outcome);
                runs++;
                rejected += outcome.EnvelopeError is not null || outcome.Replay is { IsFailure: true } ? 1 : 0;
            }
        }

        Assert.True(runs > 0, "No accepted case to mutate.");
        Assert.True(rejected > 0, "No mutation was rejected: the fuzz is not reaching the parser.");
    }

    [Fact]
    public void RepeatedKeyInAnAcceptedLog_IsRejected()
    {
        foreach (var goldenCase in Cases.Where(IsAccepted).Where(goldenCase => goldenCase.GetProperty("events").GetArrayLength() > 0))
        {
            var rawEvents = EventLogGoldenTests.RawEventsOf(goldenCase);
            var withRepeat = rawEvents.SetItem(0, "{\"batch\":1," + rawEvents[0][1..]);

            var outcome = EventLogPipeline.Run(AppendFixture.Config(EnvelopeJson.Court), withRepeat);

            Assert.Equal(EventLogSchema.EnvelopeRootField, outcome.EnvelopeError?.Field);
        }
    }

    private static bool IsAccepted(JsonElement goldenCase) =>
        goldenCase.GetProperty("expected").GetProperty("ok").GetBoolean();

    private static List<string> Mutate(IReadOnlyList<string> rawEvents, Random random)
    {
        var mutated = rawEvents.ToList();
        if (mutated.Count == 0)
        {
            mutated.Add(EnvelopeJson.Valid());
        }

        var index = random.Next(mutated.Count);
        var envelope = JsonNode.Parse(mutated[index])!.AsObject();
        Mutations[random.Next(Mutations.Length)](envelope, random);
        // JsonNode cannot write a lone surrogate, so the hostile value goes in as text after writing.
        var hostile = HostileValues[random.Next(HostileValues.Length)];
        mutated[index] = envelope.ToJsonString().Replace(QuotedPlaceholder, hostile, StringComparison.Ordinal);
        return mutated;
    }

    private static string AnyField(Random random) => EnvelopeFields.All[random.Next(EnvelopeFields.All.Length)];

    private static void SetField(JsonObject envelope, Random random) => envelope[AnyField(random)] = Placeholder();

    private static void RemoveField(JsonObject envelope, Random random) => envelope.Remove(AnyField(random));

    private static void AddUnknownField(JsonObject envelope, Random random) => envelope[Canary] = Placeholder();

    private static void SetPayloadValue(JsonObject envelope, Random random) =>
        PayloadOf(envelope)[AppendFixture.ValueField] = Placeholder();

    private static void AddPayloadKey(JsonObject envelope, Random random) => PayloadOf(envelope)[Canary] = Placeholder();

    private static JsonValue Placeholder() => JsonValue.Create(PlaceholderText);

    private static JsonObject PayloadOf(JsonObject envelope)
    {
        if (envelope[EnvelopeFields.Payload] is JsonObject payload)
        {
            return payload;
        }

        var replacement = new JsonObject();
        envelope[EnvelopeFields.Payload] = replacement;
        return replacement;
    }

    private static void AssertNoEcho(EventLogOutcome outcome)
    {
        Assert.DoesNotContain(Canary, outcome.EnvelopeError?.ToString() ?? string.Empty, StringComparison.Ordinal);
        if (outcome.Replay is { IsFailure: true } failure)
        {
            Assert.DoesNotContain(Canary, failure.ToString(), StringComparison.Ordinal);
        }
    }
}
