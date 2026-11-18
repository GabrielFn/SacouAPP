using System.Collections.Immutable;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// The reads of a stream for whoever may take it over (ADR 0063, D5 and D7), with no lock and no replay. The stream is
/// always checked against the group and round of the route, never trusted by id alone (ADR 0040, D7).
/// </summary>
internal sealed class PostgresCourtSessionReader(MatchesDbContext database) : ICourtSessionReader
{
    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    public async Task<CourtSessionSummary?> FindSummaryAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var found = await database.CourtSessions.AsNoTracking()
            .Where(session => session.GroupId == groupId && session.RoundId == roundId)
            .Join(
                database.CourtWriters,
                session => new { CourtSessionId = session.Id, Batch = session.CurrentBatch },
                writer => new { writer.CourtSessionId, writer.Batch },
                (session, writer) => new { Session = session, writer.MemberId, writer.StartedAt })
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        return found is null
            ? null
            : new CourtSessionSummary(
                found.Session.Id,
                found.Session.CurrentBatch,
                found.Session.EventCount,
                found.MemberId,
                found.StartedAt,
                found.Session.LastEventAt,
                ScoreboardOf(found.Session));
    }

    /// <summary>The columns are all set or all null (a CHECK of the table); any null reads as no open match.</summary>
    private static CourtScoreboardRow? ScoreboardOf(CourtSessionRow session) =>
        session is { OpenMatchId: { } matchId, SetNumber: { } set, PointsA: { } pointsA, PointsB: { } pointsB, SetsA: { } setsA, SetsB: { } setsB }
            ? new CourtScoreboardRow(matchId, set, pointsA, pointsB, setsA, setsB)
            : null;

    public async Task<CourtEventPage?> ListEventsAsync(
        Guid groupId, Guid roundId, Guid courtSessionId, long after, int maxEvents, long maxBytes, CancellationToken cancellationToken)
    {
        var eventCount = await database.CourtSessions.AsNoTracking()
            .Where(session => session.Id == courtSessionId && session.GroupId == groupId && session.RoundId == roundId)
            .Select(session => (int?)session.EventCount)
            .SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (eventCount is not { } count)
        {
            return null;
        }

        // Up to the count read first, so the page and the count agree even while a write commits in between.
        var rows = await database.CourtEvents.AsNoTracking()
            .Where(item => item.CourtSessionId == courtSessionId && item.Position > after && item.Position <= count)
            .OrderBy(item => item.Position)
            .Take(maxEvents)
            .Select(item => new { item.Position, item.Envelope })
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        var page = WithinBytes([.. rows.Select(row => row.Envelope)], maxBytes);
        var lastPosition = page.IsEmpty ? Math.Min(after, count) : rows[page.Length - 1].Position;
        return new CourtEventPage(page, lastPosition, count);
    }

    /// <summary>The first envelopes whose bytes fit together; the first one always goes (an envelope is far smaller than a page).</summary>
    private static ImmutableArray<string> WithinBytes(ImmutableArray<string> envelopes, long maxBytes)
    {
        var total = 0L;
        var taken = 0;
        foreach (var envelope in envelopes)
        {
            total += StrictUtf8.GetByteCount(envelope);
            if (taken > 0 && total > maxBytes)
            {
                break;
            }

            taken++;
        }

        return envelopes[..taken];
    }
}
