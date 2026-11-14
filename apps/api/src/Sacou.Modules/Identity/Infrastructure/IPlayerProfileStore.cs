using Sacou.Modules.Identity.Domain.Profiles;
using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>Where profiles live: one per user, written in one statement, the last write wins (ADR 0051, D10).</summary>
internal interface IPlayerProfileStore
{
    Task<PlayerProfile?> FindAsync(UserId user, CancellationToken cancellationToken);

    Task UpsertAsync(PlayerProfile profile, CancellationToken cancellationToken);

    /// <summary>The profiles of the users that have one, in one query; a user without a profile is simply absent.</summary>
    Task<IReadOnlyList<PlayerProfile>> FindManyAsync(IReadOnlyCollection<Guid> users, CancellationToken cancellationToken);
}
