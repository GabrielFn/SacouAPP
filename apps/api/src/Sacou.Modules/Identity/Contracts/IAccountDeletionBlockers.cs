namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// What stops the person from deleting the account now, for <c>GET /v1/me/deletion-blockers</c> (screen 30b) and,
/// in part 2 of E3.16, for the delete itself under the locks (ADR 0056, D3 and D10). Implemented by the modules that
/// can block; the Identity never reads their tables.
/// </summary>
/// <remarks>An implementation names only groups the person already sees as an active admin, never another person.</remarks>
public interface IAccountDeletionBlockers
{
    /// <summary>Every blocker of the person, in no given order; empty when nothing blocks.</summary>
    Task<IReadOnlyList<DeletionBlocker>> FindAsync(Guid userId, CancellationToken cancellationToken);
}

/// <summary>One group the person must hand over before deleting the account.</summary>
public sealed record DeletionBlocker(Guid GroupId, string GroupName, DeletionBlockerKind Kind);

public enum DeletionBlockerKind
{
    /// <summary>The person is the only active admin, and another active member has an account to promote (screen 19).</summary>
    LastAdmin,
}
