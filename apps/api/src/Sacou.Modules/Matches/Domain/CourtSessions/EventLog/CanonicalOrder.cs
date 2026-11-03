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

        var byBatch = x.Batch.CompareTo(y.Batch);
        if (byBatch != 0)
        {
            return byBatch;
        }

        var bySequence = x.Sequence.CompareTo(y.Sequence);
        if (bySequence != 0)
        {
            return bySequence;
        }

        var byDevice = string.CompareOrdinal(x.DeviceId, y.DeviceId);
        return byDevice != 0 ? byDevice : string.CompareOrdinal(x.EventId, y.EventId);
    }
}
