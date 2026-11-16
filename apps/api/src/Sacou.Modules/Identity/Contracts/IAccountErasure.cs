namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// What each module erases of the person when the account goes, <c>DELETE /v1/me</c> (E3.16, ADR 0056, D6 and D7).
/// Implemented by the modules that keep the person's links (Groups, in the pilot); the Identity never reads their
/// tables. Each call is one transaction of that module and is idempotent: a second call finds nothing left to erase.
/// </summary>
/// <remarks>
/// An implementation keeps the history by member id (the former player) and emits no event (D8). It never logs an id.
/// </remarks>
public interface IAccountErasure
{
    /// <summary>
    /// With <see cref="ErasureMode.Checked"/>, the groups that block the deletion, judged under the locks, and then
    /// nothing is written; empty when the erasure ran. With <see cref="ErasureMode.Sweep"/>, always empty.
    /// </summary>
    Task<IReadOnlyList<Guid>> EraseAsync(Guid userId, ErasureMode mode, CancellationToken cancellationToken);
}

public enum ErasureMode
{
    /// <summary>The first pass: checks the deletion blockers under the locks before writing anything.</summary>
    Checked,

    /// <summary>The last pass, after the account is gone: erases whatever joined in between, without checking.</summary>
    Sweep,
}
