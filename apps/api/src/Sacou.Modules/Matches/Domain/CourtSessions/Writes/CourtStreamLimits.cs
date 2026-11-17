namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// The ceilings of a write to the court stream (ADR 0060, D9). Technical limits, not volleyball rules:
/// they bound what one request and one stream cost the server, measured on the largest honest round.
/// </summary>
internal static class CourtStreamLimits
{
    private const int Kibibyte = 1024;

    /// <summary>200 events of about 300 bytes fit with room; so do about 62 of the largest <c>QueueChanged</c>.</summary>
    public const int MaxRequestBytes = 256 * Kibibyte;

    public const int MinEventsPerRequest = 1;

    /// <summary>A late send goes in pieces of this size (E4.11).</summary>
    public const int MaxEventsPerRequest = 200;

    /// <summary>
    /// About four times the largest <c>QueueChanged</c> (~4.1 KB). Measured on the bytes before any tree
    /// is built, because the raw value reader allocates about 32 times the text.
    /// </summary>
    public const int MaxEnvelopeBytes = 16 * Kibibyte;

    /// <summary>A long round has about 1,500 (15 matches of about 100 events); 20,000 cost ~0.35 s of parse and replay.</summary>
    public const int MaxStreamEvents = 20_000;

    /// <summary>20,000 points of ~290 bytes are ~5.8 MB; the replay keeps about 3.7 times that.</summary>
    public const long MaxStreamBytes = 8L * Kibibyte * Kibibyte;

    /// <summary>A best of 5 to 25 points, with advantage and corrections.</summary>
    public const int MaxMatchEvents = 1_500;

    /// <summary>The worst case by bytes after the <c>QueueChanged</c>.</summary>
    public const int MaxMatchLineupChanges = 120;

    /// <summary>A rare correction.</summary>
    public const int MaxMatchServingChanges = 60;

    /// <summary>Undo is frequent, but each one walks the timeline.</summary>
    public const int MaxMatchReverts = 300;

    /// <summary>Answering again is legitimate; repeating forever is not.</summary>
    public const int MaxPointAttributions = 3;

    /// <summary>Up to ~1.2 MB in the worst case.</summary>
    public const int MaxStreamQueueChanges = 300;

    /// <summary>The batch of the first writer of a stream, which is also the value of the local log (ADR 0038).</summary>
    public const long FirstBatch = 1;
}
