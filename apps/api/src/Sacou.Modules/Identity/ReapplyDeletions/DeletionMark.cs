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

/// <summary>
/// What a run did, only numbers (ADR 0056, D11): the marks read from the current database, those the restored one did
/// not have, the accounts erased again and the groups left without an admin and with no one to promote.
/// </summary>
public sealed record ReapplyDeletionsSummary(int Marks, int NewMarks, int AccountsErased, int GroupsWithoutAdmin, TimeSpan Elapsed);
