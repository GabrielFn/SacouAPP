using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.ReapplyDeletions;

/// <summary>A row of <c>identity.deleted_accounts</c> read from the current database: the hash of the login and when it went.</summary>
internal sealed record DeletionMark(byte[] SubjectHash, DateTimeOffset DeletedAt)
{
    /// <summary>Never print the hash: it stands for one person.</summary>
    public override string ToString() => nameof(DeletionMark);
}

/// <summary>An account of the restored database whose login has a mark: the person who must go again.</summary>
internal sealed record MarkedAccount(UserId User, AuthSubject Subject)
{
    /// <summary>Never print the login.</summary>
    public override string ToString() => nameof(MarkedAccount);
}
