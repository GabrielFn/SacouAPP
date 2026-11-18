using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;
using static Sacou.Modules.Matches.Tests.CourtSessions.Writes.CourtWriteFixture;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>The coherence checks of <see cref="CourtWriteRequest"/>, before any lock (ADR 0060, D8 step 4).</summary>
public sealed class CourtWriteRequestTests
{
    private const string Pt = ScoreEventTypes.PointScored;
    private const string OtherCourt = "c0000000-0000-4000-8000-000000000002";
    private const string UnknownType = "PlayerCheered";
    private const long UnsupportedSchemaVersion = 999;

    private static string PointAt(long sequence, string? device = null, long batch = 1, string? eventId = null) =>
        Envelope(sequence, Pt, Point("a"), device, batch, eventId);

    private static string InCourt(string envelope, string court) => envelope.Replace(Court, court, StringComparison.Ordinal);

    private static string WithSchemaVersion(string envelope, long version) =>
        envelope.Replace("\"schemaVersion\":1", $"\"schemaVersion\":{version}", StringComparison.Ordinal);

    private static string OfType(string envelope, string type) =>
        envelope.Replace($"\"type\":\"{Pt}\"", $"\"type\":\"{type}\"", StringComparison.Ordinal);

    private static Result<CourtWriteRequest, CourtWriteError> Create(params string[] envelopes) =>
        CourtWriteRequest.Create(Court, [.. envelopes.Select(Parse)], SupportedVersions.EventSchemaVersions);

    private static void AssertRefused(CourtWriteErrorCode code, string? eventId, Result<CourtWriteRequest, CourtWriteError> result)
    {
        Assert.True(result.IsFailure, "Expected a refusal.");
        Assert.Equal(code, result.Error.Code);
        Assert.Equal(eventId, result.Error.EventId);
    }

    [Fact]
    public void ACoherentRequest_IsAccepted_WithItsDeviceAndBatch()
    {
        var result = Create(PointAt(4, batch: 2), PointAt(5, batch: 2));

        Assert.True(result.IsSuccess);
        Assert.Equal(Device, result.Value.DeviceId);
        Assert.Equal(2, result.Value.Batch);
        Assert.Equal(2, result.Value.Events.Length);
    }

    [Fact]
    public void AnEventOfAnotherStream_IsAStreamMismatch_AtTheFirstForeignEvent()
    {
        AssertRefused(
            CourtWriteErrorCode.StreamMismatch,
            EventId(2),
            Create(PointAt(1), InCourt(PointAt(2), OtherCourt), InCourt(PointAt(3), OtherCourt)));
    }

    [Fact]
    public void NoEvent_IsAnInvalidBatch()
    {
        AssertRefused(CourtWriteErrorCode.BatchInvalid, null, Create());
    }

    [Fact]
    public void MoreEventsThanTheCeiling_IsAnInvalidBatch_AndTheCeilingIsAccepted()
    {
        var ceiling = Enumerable.Range(1, CourtStreamLimits.MaxEventsPerRequest).Select(sequence => PointAt(sequence)).ToArray();

        Assert.True(Create(ceiling).IsSuccess);
        AssertRefused(CourtWriteErrorCode.BatchInvalid, null, Create([.. ceiling, PointAt(CourtStreamLimits.MaxEventsPerRequest + 1)]));
    }

    [Fact]
    public void TwoDevices_IsAnInvalidBatch()
    {
        AssertRefused(CourtWriteErrorCode.BatchInvalid, null, Create(PointAt(1), PointAt(2, device: OtherDevice)));
    }

    [Fact]
    public void TwoBatches_IsAnInvalidBatch()
    {
        AssertRefused(CourtWriteErrorCode.BatchInvalid, null, Create(PointAt(1), PointAt(2, batch: 2)));
    }

    [Fact]
    public void AnInnerGap_IsAnInvalidBatch()
    {
        AssertRefused(CourtWriteErrorCode.BatchInvalid, null, Create(PointAt(1), PointAt(3)));
    }

    [Fact]
    public void OutOfOrder_IsAnInvalidBatch()
    {
        AssertRefused(CourtWriteErrorCode.BatchInvalid, null, Create(PointAt(2), PointAt(1)));
    }

    [Fact]
    public void ARepeatedEventId_IsAnInvalidBatch()
    {
        AssertRefused(CourtWriteErrorCode.BatchInvalid, null, Create(PointAt(1), PointAt(2, eventId: EventId(1))));
    }

    [Fact]
    public void AnUnsupportedSchemaVersion_IsRefused_AtTheFirstEventWithIt()
    {
        AssertRefused(
            CourtWriteErrorCode.UnsupportedSchemaVersion,
            EventId(2),
            Create(PointAt(1), WithSchemaVersion(PointAt(2), UnsupportedSchemaVersion), WithSchemaVersion(PointAt(3), UnsupportedSchemaVersion)));
    }

    [Fact]
    public void AnUnknownEventType_IsRefused_AtTheFirstEventWithIt()
    {
        AssertRefused(
            CourtWriteErrorCode.UnknownEventType,
            EventId(2),
            Create(PointAt(1), OfType(PointAt(2), UnknownType), OfType(PointAt(3), UnknownType)));
    }

    /// <summary>Every check fails here, so the order of D8 step 4 decides: stream, batch, schema version, type.</summary>
    [Fact]
    public void TheFirstFailingCheck_Decides()
    {
        string AllWrong(long sequence) => OfType(WithSchemaVersion(PointAt(sequence, device: OtherDevice), UnsupportedSchemaVersion), UnknownType);
        string NoBatchOrStreamError(long sequence) => OfType(WithSchemaVersion(PointAt(sequence), UnsupportedSchemaVersion), UnknownType);

        AssertRefused(CourtWriteErrorCode.StreamMismatch, EventId(2), Create(PointAt(1), InCourt(AllWrong(2), OtherCourt)));
        AssertRefused(CourtWriteErrorCode.BatchInvalid, null, Create(PointAt(1), AllWrong(2)));
        AssertRefused(CourtWriteErrorCode.UnsupportedSchemaVersion, EventId(2), Create(PointAt(1), NoBatchOrStreamError(2)));
        AssertRefused(CourtWriteErrorCode.UnknownEventType, EventId(2), Create(PointAt(1), OfType(PointAt(2), UnknownType)));
    }

    [Fact]
    public void AStreamEvent_NeverPrintsItsEnvelope()
    {
        var text = Parse(PointAt(1)).ToString();

        Assert.Equal(nameof(StreamEvent), text);
        Assert.DoesNotContain(Device, text, StringComparison.Ordinal);
    }
}
