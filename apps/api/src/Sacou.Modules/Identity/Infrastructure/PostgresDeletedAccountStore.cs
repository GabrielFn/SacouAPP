using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>Parameterized statements only (EF turns the interpolated values into parameters).</summary>
internal sealed class PostgresDeletedAccountStore(IdentityDbContext database) : IDeletedAccountStore
{
    public Task<bool> IsDeletedAsync(AuthSubject subject, CancellationToken cancellationToken)
    {
        var hash = SubjectHash.Of(subject).ToArray();
        return database.DeletedAccounts.AsNoTracking().AnyAsync(row => row.SubjectHash == hash, cancellationToken);
    }

    public async Task DeleteAsync(UserId user, AuthSubject subject, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var hash = SubjectHash.Of(subject).ToArray();
        var transaction = await database.Database.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
        await using (transaction.ConfigureAwait(false))
        {
            await SubjectLock.AcquireAsync(database, subject, cancellationToken).ConfigureAwait(false);
            await database.Database.ExecuteSqlAsync(
                $"""
                INSERT INTO identity.deleted_accounts (subject_hash, deleted_at) VALUES ({hash}, {now})
                ON CONFLICT (subject_hash) DO NOTHING
                """,
                cancellationToken).ConfigureAwait(false);
            await database.Database.ExecuteSqlAsync(
                $"DELETE FROM identity.users WHERE id = {user.Value}", cancellationToken).ConfigureAwait(false);
            await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        }
    }
}
