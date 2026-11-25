using System.Collections.Immutable;
using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>The rows a write stores, and the reads of the projections and of the personal data export.</summary>
internal sealed partial class PostgresCourtStreamStore
{
    private async Task WriteAsync(CourtAppend append, CourtSessionRow session, CourtWriteDecision decision, CancellationToken cancellationToken)
    {
        if (decision.CreatesStream)
        {
            database.CourtWriters.Add(NewWriterRow(session.Id, decision.Writer, append.Now));
        }

        database.CourtEvents.AddRange(decision.NewEvents.Select((item, index) => ToRow(append, session.EventCount + FirstPosition + index, item)));
        await database.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await UpdateCountersAsync(append, session.Id, decision, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The counters, the time of the last event and the scoreboard after the write, null with no open match (ADR 0063, D6).</summary>
    private async Task UpdateCountersAsync(CourtAppend append, Guid courtSessionId, CourtWriteDecision decision, CancellationToken cancellationToken)
    {
        var addedEvents = decision.NewEvents.Length;
        var addedBytes = decision.NewEvents.Sum(item => item.ByteCount);
        var board = decision.Scoreboard;
        Guid? matchId = board is null ? null : Guid.Parse(board.MatchId);
        _ = await database.CourtSessions
            .Where(row => row.Id == courtSessionId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(row => row.EventCount, row => row.EventCount + addedEvents)
                    .SetProperty(row => row.EnvelopeBytes, row => row.EnvelopeBytes + addedBytes)
                    .SetProperty(row => row.LastEventAt, append.Now)
                    .SetProperty(row => row.OpenMatchId, matchId)
                    .SetProperty(row => row.SetNumber, board?.SetNumber)
                    .SetProperty(row => row.PointsA, board?.PointsA)
                    .SetProperty(row => row.PointsB, board?.PointsB)
                    .SetProperty(row => row.SetsA, board?.SetsA)
                    .SetProperty(row => row.SetsB, board?.SetsB),
                cancellationToken)
            .ConfigureAwait(false);
    }

    private static CourtEventRow ToRow(CourtAppend append, int position, StreamEvent item)
    {
        var envelope = item.Envelope;
        return new CourtEventRow
        {
            CourtSessionId = append.CourtSessionId,
            Position = position,
            EventId = Guid.Parse(envelope.EventId),
            Batch = envelope.Batch,
            Sequence = envelope.Sequence,
            DeviceId = Guid.Parse(envelope.DeviceId),
            SchemaVersion = envelope.SchemaVersion,
            Type = envelope.Type,
            MatchId = MatchIdOf(envelope),
            Envelope = append.EnvelopeTexts[envelope.EventId],
            ReceivedAt = append.Now,
        };
    }

    /// <summary>The <c>matchId</c> of the payload, which the replay already proved a UUID; none for a revert or a queue change.</summary>
    private static Guid? MatchIdOf(EventEnvelope envelope) =>
        envelope.Payload.TryGetMember(PayloadFields.MatchId, out var value) && value is RawString text && Guid.TryParse(text.Value, out var id)
            ? id
            : null;

    public async Task<IReadOnlyList<AccountCourtWrite>> ListOfMembersAsync(IReadOnlyCollection<Guid> members, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(members);
        if (members.Count == 0)
        {
            return [];
        }

        return await database.CourtWriters.AsNoTracking()
            .Where(writer => members.Contains(writer.MemberId))
            .Join(database.CourtSessions, writer => writer.CourtSessionId, session => session.Id, (writer, session) => new { Writer = writer, session.RoundId })
            .OrderBy(found => found.Writer.StartedAt).ThenBy(found => found.Writer.CourtSessionId).ThenBy(found => found.Writer.Batch)
            .Select(found => new AccountCourtWrite(found.Writer.CourtSessionId, found.RoundId, found.Writer.Batch, found.Writer.DeviceId, found.Writer.StartedAt))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
    }
}
