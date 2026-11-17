using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>
/// Reads <c>server-checks.json</c>, the golden the TypeScript test also reads: the refused logs pass the
/// replay of the engine, and only the write rules of the server refuse them (ADR 0060, D12).
/// </summary>
public sealed class ServerChecksGoldenTests
{
    private const int GoldenCaseCount = 19;

    private static readonly string[] GoldenIds =
    [
        "s1-a-full-match-with-a-toss-for-the-deciding-set",
        "s2-serve-corrections-attribution-queue-and-manual-end",
        "s3-rotations-an-ace-of-the-server-and-a-block-after-a-side-out",
        "s4-an-undo-and-the-point-again",
        "r1-set-ended-at-0-0",
        "r2-point-in-a-decided-set",
        "r3-wrong-target-points-of-the-tie-break",
        "r4-setter-zones-swapped",
        "r5-first-server-not-alternated",
        "r6-serving-team-changed-to-the-same-team",
        "r7-lineup-changed-while-the-match-is-pending",
        "r8-orphan-point-attributed",
        "r9-ace-of-the-receiving-team",
        "r10-queue-changed-to-the-same-queue",
        "r11-unsupported-rules-version",
        "r12-member-outside-the-group",
        "r13-two-set-ended-at-0-0-and-a-match-won",
        "r14-match-won-by-the-wrong-team",
        "r15-unsupported-formations-version",
    ];

    private static readonly HashSet<string> CaseFields = ["id", "events", "groupMemberIds", "commands", "expected"];

    private static readonly HashSet<string> ExpectedFields = ["ok", "code", "eventId", "reason"];

    private static readonly IReadOnlyList<JsonElement> Cases = GoldenFile.ReadEmbeddedCases("server-checks.json");

    public static TheoryData<string> CaseIds => new(GoldenIds);

    public static TheoryData<string> AcceptedIds => new(Cases
        .Where(goldenCase => goldenCase.GetProperty("expected").GetProperty("ok").GetBoolean())
        .Select(GoldenFile.IdOf));

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
    public void Decide_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var expected = goldenCase.GetProperty("expected");
        GoldenFile.AssertOnlyFields(expected, ExpectedFields, id);

        var result = CourtWriteFixture.Decide(StoredStream.New, EventsOf(goldenCase), ContextOf(goldenCase));

        if (expected.GetProperty("ok").GetBoolean())
        {
            Assert.Equal(EventsOf(goldenCase).Length, CourtWriteFixture.Accepted(result).NewEvents.Length);
            return;
        }

        var error = CourtWriteFixture.Refused(result);
        Assert.Equal(GoldenFile.Text(expected, "code"), error.Code.Code);
        Assert.Equal(GoldenFile.Text(expected, "eventId"), error.EventId);
        Assert.Equal(expected.TryGetProperty("reason", out var reason) ? reason.GetString() : null, error.Reason);
    }

    /// <summary>Sent at each point, as the app does (ADR 0046): one event per request, each over the stream stored so far.</summary>
    [Theory]
    [MemberData(nameof(AcceptedIds))]
    public void AcceptedCase_IsAcceptedOneEventPerRequest(string id)
    {
        var goldenCase = GoldenFile.SingleCase(Cases, GoldenFile.IdOf, id);
        var context = ContextOf(goldenCase);
        var stored = ImmutableArray<StreamEvent>.Empty;
        foreach (var item in EventsOf(goldenCase))
        {
            var stream = stored.IsEmpty ? StoredStream.New : CourtWriteFixture.Stored(stored);
            var decision = CourtWriteFixture.Accepted(CourtWriteFixture.Decide(stream, [item], context));
            Assert.Equal(item.Envelope.Sequence, decision.LastSequence);
            stored = stored.AddRange(decision.NewEvents);
        }
    }

    internal static ImmutableArray<StreamEvent> EventsOf(JsonElement goldenCase) =>
        [.. goldenCase.GetProperty("events").EnumerateArray().Select(rawEvent => CourtWriteFixture.Parse(rawEvent.GetRawText()))];

    private static CourtWriteContext ContextOf(JsonElement goldenCase) =>
        CourtWriteFixture.Context with
        {
            GroupMemberIds = goldenCase.GetProperty("groupMemberIds").EnumerateArray()
                .Select(memberId => memberId.GetString()!)
                .ToImmutableHashSet(StringComparer.Ordinal),
        };
}
