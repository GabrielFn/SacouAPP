using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// The per-login advisory lock, in the caller's transaction: a first sign-in and the deletion of the same login run
/// one after the other, so a sign-in that starts while the account is being deleted never creates it again (D5).
/// </summary>
internal static class SubjectLock
{
    /// <summary>First key of the two-key advisory lock: "one login", apart from every other lock family.</summary>
    private const int Family = 1_101;

    public static Task<int> AcquireAsync(IdentityDbContext database, AuthSubject subject, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(database);
        ArgumentNullException.ThrowIfNull(subject);
        return database.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock({Family}, hashtext({subject.Value}))", cancellationToken);
    }
}
