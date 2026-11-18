namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// A row of <c>matches.court_sessions</c>: one court stream of a round, its current batch and its counters.
/// The scoreboard columns are the summary the E3.8 writes (ADR 0060, D13); null with no open match.
/// Persistence shape only: the domain never sees it.
/// </summary>
internal sealed class CourtSessionRow
{
    public required Guid Id { get; init; }

    public required Guid GroupId { get; init; }

    public required Guid RoundId { get; init; }

    public required long CurrentBatch { get; init; }

    public required int EventCount { get; init; }

    public required long EnvelopeBytes { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? LastEventAt { get; init; }

    public Guid? OpenMatchId { get; init; }

    public int? SetNumber { get; init; }

    public int? PointsA { get; init; }

    public int? PointsB { get; init; }

    public int? SetsA { get; init; }

    public int? SetsB { get; init; }
}

/// <summary>
/// A row of <c>matches.court_writers</c>: who wrote one batch of a stream, by device and <c>MemberId</c>,
/// and how many events the stream had when the batch started (the E3.8 takeover reads it).
/// </summary>
internal sealed class CourtWriterRow
{
    public required Guid CourtSessionId { get; init; }

    public required long Batch { get; init; }

    public required Guid DeviceId { get; init; }

    public required Guid MemberId { get; init; }

    public required long EventsBefore { get; init; }

    public required DateTimeOffset StartedAt { get; init; }
}

/// <summary>
/// A row of <c>matches.court_events</c>: one envelope as received, in <c>text</c>, plus the columns the
/// constraints and the projections need. No name and no payload column (ADR 0060, D13).
/// </summary>
internal sealed class CourtEventRow
{
    public required Guid CourtSessionId { get; init; }

    /// <summary>The arrival order in the stream, 1 to n.</summary>
    public required int Position { get; init; }

    public required Guid EventId { get; init; }

    public required long Batch { get; init; }

    public required long Sequence { get; init; }

    public required Guid DeviceId { get; init; }

    public required long SchemaVersion { get; init; }

    public required string Type { get; init; }

    public Guid? MatchId { get; init; }

    public required string Envelope { get; init; }

    public required DateTimeOffset ReceivedAt { get; init; }
}
