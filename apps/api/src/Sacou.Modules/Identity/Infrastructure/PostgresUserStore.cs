using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// One statement each (the insert in a short transaction that holds the login's lock), always parameterized (EF turns the interpolated values into parameters). The
/// unique index on <c>firebase_uid</c> is the guarantee: a concurrent insert does nothing, with no
/// exception as control flow (ADR 0037, D6).
/// </summary>
internal sealed class PostgresUserStore(IdentityDbContext database) : IUserStore
{
    public async Task<UserId?> FindIdAsync(AuthSubject subject, CancellationToken cancellationToken)
    {
        var ids = await database.Database
            .SqlQuery<Guid>($"SELECT id AS \"Value\" FROM identity.users WHERE firebase_uid = {subject.Value}")
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return ids.Count == 0 ? null : new UserId(ids[0]);
    }

    public async Task<DateTimeOffset?> FindCreatedAtAsync(UserId user, CancellationToken cancellationToken)
    {
        var found = await database.Users.AsNoTracking()
            .Where(row => row.Id == user)
            .Select(row => (DateTimeOffset?)row.CreatedAt)
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        return found;
    }

    /// <summary>
    /// Under the login's lock, and never for a deleted login (the tombstone of ADR 0056, D5): a sign-in that races the
    /// deletion of the same account waits for it, then finds the tombstone and creates nothing.
    /// </summary>
    public async Task<bool> TryCreateAsync(User user, CancellationToken cancellationToken)
    {
        var hash = SubjectHash.Of(user.Subject).ToArray();
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            await SubjectLock.AcquireAsync(database, user.Subject, cancellationToken).ConfigureAwait(false);
            var inserted = await database.Database
                .ExecuteSqlAsync(
                    $"""
                    INSERT INTO identity.users (id, firebase_uid, created_at)
                    SELECT {user.Id.Value}, {user.Subject.Value}, {user.CreatedAt}
                    WHERE NOT EXISTS (SELECT 1 FROM identity.deleted_accounts WHERE subject_hash = {hash})
                    ON CONFLICT (firebase_uid) DO NOTHING
                    """,
                    cancellationToken)
                .ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
            return inserted == 1;
        }
    }
}
