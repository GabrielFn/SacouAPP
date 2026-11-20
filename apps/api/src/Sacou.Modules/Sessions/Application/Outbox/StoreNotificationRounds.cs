using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Sessions.Infrastructure;

namespace Sacou.Modules.Sessions.Application.Outbox;

/// <summary>
/// The Sessions' side of <see cref="INotificationRounds"/> (ADR 0069, D3): one read without a lock, by the pairs asked,
/// the local date and time as stored. A pair whose round belongs to another group is not found.
/// </summary>
internal sealed class StoreNotificationRounds(SessionsDbContext database) : INotificationRounds
{
    public async Task<IReadOnlyList<NotificationRound>> FindAsync(
        IReadOnlyCollection<NotificationRoundKey> rounds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(rounds);
        if (rounds.Count == 0)
        {
            return [];
        }

        var wanted = rounds.ToHashSet();
        var ids = rounds.Select(key => key.RoundId).Distinct().ToList();
        var groups = rounds.Select(key => key.GroupId).Distinct().ToList();
        var rows = await database.Rounds.AsNoTracking()
            .Where(round => ids.Contains(round.Id) && groups.Contains(round.GroupId))
            .Select(round => new NotificationRound(round.GroupId, round.Id, round.LocalDate, round.LocalTime, round.Venue))
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Where(round => wanted.Contains(new NotificationRoundKey(round.GroupId, round.RoundId)))];
    }
}
