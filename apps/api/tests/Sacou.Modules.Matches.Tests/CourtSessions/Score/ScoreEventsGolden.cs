using System.Buffers;
using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>The outcome of an event golden case: the first parser error, else the replay result.</summary>
internal sealed record ScoreEventsOutcome(
    EnvelopeError? EnvelopeError,
    Result<ReplayedState<CourtSessionState>, ReplayError>? Replay)
{
    public CourtSessionState State => Replay!.Value.State;
}

/// <summary>
/// Runs the event golden files of match-engine through the C# parser, replay and appliers, and
/// compares the outcome written by the production <see cref="CourtSessionStateWriter"/> with the
/// golden, key order included (ADR 0033, D7).
/// </summary>
internal static class ScoreEventsGolden
{
    /// <summary>
    /// <c>onCourt</c> and <c>consecutiveMatches</c> are checked by their own tests; <c>servingPlayer</c>
    /// and <c>substitutions</c> are for functions only TypeScript has (ADR 0027).
    /// </summary>
    private static readonly HashSet<string> CaseFields =
        ["id", "courtSessionId", "initialState", "events", "expected", "servingPlayer", "substitutions", "onCourt", "consecutiveMatches"];

    public static ScoreEventsOutcome Run(JsonElement goldenCase)
    {
        var config = ScoreAppliers.Config(
            GoldenFile.Text(goldenCase, "courtSessionId"),
            CourtSessionStateReader.Read(goldenCase.GetProperty("initialState")));
        var parsed = ImmutableArray.CreateBuilder<EventEnvelope>();
        foreach (var rawEvent in goldenCase.GetProperty("events").EnumerateArray())
        {
            var envelope = EnvelopeParser.Parse(RawValueReader.Parse(rawEvent.GetRawText()));
            if (envelope.IsFailure)
            {
                return new ScoreEventsOutcome(envelope.Error, null);
            }

            parsed.Add(envelope.Value);
        }

        return new ScoreEventsOutcome(null, EventReplayer.ReplayEvents(config, parsed));
    }

    /// <summary>
    /// The timeline of a case whose envelopes are all valid, as <c>replayCase</c> of the attribution
    /// and stats tests; <c>null</c> when an envelope fails.
    /// </summary>
    public static Result<ReplayedTimeline<CourtSessionState>, ReplayError>? RunTimeline(
        JsonElement goldenCase,
        Func<EventEnvelope, bool>? keep = null)
    {
        var config = ScoreAppliers.Config(
            GoldenFile.Text(goldenCase, "courtSessionId"),
            CourtSessionStateReader.Read(goldenCase.GetProperty("initialState")));
        var parsed = goldenCase.GetProperty("events").EnumerateArray()
            .Select(rawEvent => EnvelopeParser.Parse(RawValueReader.Parse(rawEvent.GetRawText())))
            .ToList();
        return parsed.Any(envelope => envelope.IsFailure)
            ? null
            : EventReplayer.ReplayTimeline(config, parsed.Select(envelope => envelope.Value).Where(keep ?? (_ => true)));
    }

    /// <summary>Checks one case; <paramref name="skippedKeys"/> are keys of <c>expected</c> checked elsewhere.</summary>
    public static void AssertCase(IReadOnlyList<JsonElement> cases, string id, params string[] skippedKeys)
    {
        var goldenCase = GoldenFile.SingleCase(cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var outcome = Run(goldenCase);

        using var expected = Without(goldenCase.GetProperty("expected"), skippedKeys);
        OrderedJsonAssert.Equal(expected.RootElement, writer => Write(writer, outcome), id);
    }

    /// <summary>Who is on the court in the open match, as <c>onCourtOf</c> in the TypeScript tests.</summary>
    public static void AssertOnCourt(IReadOnlyList<JsonElement> cases, string id)
    {
        var goldenCase = GoldenFile.SingleCase(cases, GoldenFile.IdOf, id);
        var match = Run(goldenCase).State.CurrentMatch;
        Assert.NotNull(match);

        OrderedJsonAssert.Equal(goldenCase.GetProperty("onCourt"), writer =>
        {
            writer.WriteStartObject();
            foreach (var side in TeamSide.All)
            {
                writer.WritePropertyName(side.Code);
                if (match.Rotations.Of(side) is { } teamState)
                {
                    var phase = match.CurrentSet?.ServingTeam == side ? FormationPhase.Serving : FormationPhase.Receiving;
                    CourtSessionGoldenReader.WriteTexts(writer, LiberoRules.GetOnCourtBySlot(teamState, phase));
                }
                else
                {
                    writer.WriteNullValue();
                }
            }

            writer.WriteEndObject();
        }, id);
    }

    public static IEnumerable<string> IdsWith(IReadOnlyList<JsonElement> cases, string field) =>
        cases.Where(goldenCase => goldenCase.TryGetProperty(field, out _)).Select(GoldenFile.IdOf);

    /// <summary>The same keys, in the same order, as <c>{ ok, ...value }</c> and <c>{ ok, ...error }</c> in TypeScript.</summary>
    public static void Write(Utf8JsonWriter writer, ScoreEventsOutcome outcome)
    {
        writer.WriteStartObject();
        if (outcome.EnvelopeError is { } envelopeError)
        {
            writer.WriteBoolean("ok", false);
            writer.WriteString("code", envelopeError.Code);
            writer.WriteString("field", envelopeError.Field);
        }
        else if (outcome.Replay is { IsFailure: true } failure)
        {
            writer.WriteBoolean("ok", false);
            writer.WriteString("code", failure.Error.Code.Code);
            writer.WriteString("eventId", failure.Error.EventId);
        }
        else
        {
            writer.WriteBoolean("ok", true);
            writer.WritePropertyName("state");
            CourtSessionStateWriter.Write(writer, outcome.State);
            CourtSessionGoldenReader.WriteTexts(writer, "activeEventIds", outcome.Replay!.Value.ActiveEventIds);
        }

        writer.WriteEndObject();
    }

    private static JsonDocument Without(JsonElement record, string[] keys)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            foreach (var member in record.EnumerateObject().Where(member => !keys.Contains(member.Name)))
            {
                member.WriteTo(writer);
            }

            writer.WriteEndObject();
        }

        return JsonDocument.Parse(buffer.WrittenMemory);
    }
}
