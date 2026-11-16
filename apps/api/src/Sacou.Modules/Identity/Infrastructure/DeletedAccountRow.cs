namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>A row of <c>identity.deleted_accounts</c>: the hash of a deleted login and when it was deleted, nothing else.</summary>
internal sealed class DeletedAccountRow
{
    public required byte[] SubjectHash { get; init; }

    public required DateTimeOffset DeletedAt { get; init; }
}
