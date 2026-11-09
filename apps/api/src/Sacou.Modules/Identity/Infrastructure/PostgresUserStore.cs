using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// One statement each, always parameterized (EF turns the interpolated values into parameters). The
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

    public async Task<bool> TryCreateAsync(User user, CancellationToken cancellationToken)
    {
        var inserted = await database.Database
            .ExecuteSqlAsync(
                $"""
                INSERT INTO identity.users (id, firebase_uid, created_at)
                VALUES ({user.Id.Value}, {user.Subject.Value}, {user.CreatedAt})
                ON CONFLICT (firebase_uid) DO NOTHING
                """,
                cancellationToken)
            .ConfigureAwait(false);
        return inserted == 1;
    }
}
