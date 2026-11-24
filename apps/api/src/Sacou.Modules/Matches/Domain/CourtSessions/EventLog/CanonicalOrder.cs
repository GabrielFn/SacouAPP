namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// Batch, then sequence, then device, then event id. Text goes by UTF-16 code unit, like the
/// TypeScript <c>&lt;</c>, and never by culture: <c>"B"</c> comes before <c>"a"</c>.
/// </summary>
internal sealed class CanonicalOrder : IComparer<EventEnvelope>
{
    public static readonly CanonicalOrder Instance = new();

    private CanonicalOrder()
    {
    }

    public int Compare(EventEnvelope? x, EventEnvelope? y)
    {
        // Null first, as IComparer asks; the replay never passes one.
        if (x is null || y is null)
        {
            return Comparer<object>.Default.Compare(x, y);
        }

        var byKey = CompareOrderKeys(x, y);
        return byKey != 0 ? byKey : string.CompareOrdinal(x.EventId, y.EventId);
    }

    /// <summary>Batch, then sequence, then device: the order key two events of one stream never share (ADR 0060, D3).</summary>
    public static int CompareOrderKeys(EventEnvelope x, EventEnvelope y)
    {
        ArgumentNullException.ThrowIfNull(x);
        ArgumentNullException.ThrowIfNull(y);
        var byBatch = x.Batch.CompareTo(y.Batch);
        if (byBatch != 0)
        {
            return byBatch;
        }

        var bySequence = x.Sequence.CompareTo(y.Sequence);
        return bySequence != 0 ? bySequence : string.CompareOrdinal(x.DeviceId, y.DeviceId);
    }
}
