using System.Text.Json;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions.Attributions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Tests.CourtSessions.EventLog;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>Port of the golden test of <c>attributions-events.json</c>, reading the same file. The state, the active events and who scored each point.</summary>
public sealed class AttributionsEventsGoldenTests
{
    private const int GoldenCaseCount = 17;

    private static readonly string[] GoldenIds =
    [
        "a1-attributed-at-once",
        "a2-attributed-later",
        "a3-the-last-attribution-wins",
        "a4-opponent-error-has-no-author",
        "a5-undone-attribution-is-not-counted",
        "a6-attribution-of-a-reverted-point-is-ignored",
        "a7-attribution-of-an-event-that-is-not-a-point-is-ignored",
        "a8-attribution-of-another-match-is-rejected",
        "a9-attribution-to-a-point-of-an-earlier-match-is-ignored",
        "a10-author-of-the-other-team-is-ignored",
        "a11-an-ignored-attribution-does-not-erase-the-valid-one",
        "a12-author-outside-the-match-is-rejected",
        "a13-attribution-before-the-point-in-the-canonical-order",
        "a14-attribution-in-a-decided-set",
        "a15-attribution-in-a-closed-set",
        "a16-attribution-after-the-end-of-the-match-is-rejected",
        "a17-a-guest-without-an-account-plays-and-scores-by-member-id",
    ];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("attributions-events.json");

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
    public void Replay_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var timeline = ScoreEventsGolden.RunTimeline(goldenCase);
        Assert.NotNull(timeline);

        OrderedJsonAssert.Equal(goldenCase.GetProperty("expected"), writer => Write(writer, timeline, goldenCase), id);
    }

    public static TheoryData<string> AcceptedWithoutRevert => new(Cases
        .Where(goldenCase => ScoreEventsGolden.RunTimeline(goldenCase) is { IsSuccess: true }
            && goldenCase.GetProperty("events").EnumerateArray().All(rawEvent =>
                rawEvent.GetProperty("type").GetString() != EventLogSchema.RevertedToEventType))
        .Select(GoldenFile.IdOf));

    [Fact]
    public void File_ChecksTheStateWithoutAttributions_InSomeCases()
    {
        Assert.NotEmpty(AcceptedWithoutRevert);
    }

    /// <summary>ADR 0031: the state is the same with and without the PointAttributed events.</summary>
    [Theory]
    [MemberData(nameof(AcceptedWithoutRevert))]
    public void Attributions_ChangeNothingInTheState(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);

        var withAll = ScoreEventsGolden.RunTimeline(goldenCase)!.Value.Entries;
        var withNone = ScoreEventsGolden.RunTimeline(
            goldenCase, envelope => envelope.Type != ScoreEventTypes.PointAttributed)!.Value.Entries;

        Assert.Equal(
            CourtSessionStateWriter.ToJson(withAll.IsEmpty ? CourtSessionState.Initial : withAll[^1].State),
            CourtSessionStateWriter.ToJson(withNone.IsEmpty ? CourtSessionState.Initial : withNone[^1].State));
    }

    private static void Write(Utf8JsonWriter writer, Domain.CourtSessions.Result<ReplayedTimeline<CourtSessionState>, ReplayError> timeline, JsonElement goldenCase)
    {
        writer.WriteStartObject();
        if (timeline.IsFailure)
        {
            writer.WriteBoolean("ok", false);
            writer.WriteString("code", timeline.Error.Code.Code);
            writer.WriteString("eventId", timeline.Error.EventId);
            writer.WriteEndObject();
            return;
        }

        var entries = timeline.Value.Entries;
        writer.WriteBoolean("ok", true);
        writer.WritePropertyName("state");
        CourtSessionStateWriter.Write(
            writer,
            entries.IsEmpty ? CourtSessionStateReader.Read(goldenCase.GetProperty("initialState")) : entries[^1].State);
        CourtSessionGoldenReader.WriteTexts(writer, "activeEventIds", entries.Select(entry => entry.Event.EventId));
        writer.WriteStartArray("attributions");
        foreach (var attribution in PointAttributionResolver.Resolve(timeline.Value))
        {
            writer.WriteStartObject();
            writer.WriteString("pointEventId", attribution.PointEventId);
            writer.WriteString("matchId", attribution.MatchId);
            writer.WriteNumber("setNumber", attribution.SetNumber);
            writer.WriteString("team", attribution.Team.Code);
            writer.WriteString("kind", attribution.Kind.Code);
            writer.WritePropertyName("author");
            if (attribution.Author is { } author)
            {
                writer.WriteStringValue(author);
            }
            else
            {
                writer.WriteNullValue();
            }

            writer.WriteEndObject();
        }

        writer.WriteEndArray();
        writer.WriteEndObject();
    }
}
