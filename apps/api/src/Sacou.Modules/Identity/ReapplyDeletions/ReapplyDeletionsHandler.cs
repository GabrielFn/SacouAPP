using Microsoft.Extensions.Logging;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.ReapplyDeletions;

/// <summary>
/// The deletions reapplied to a restored backup (E6.3, ADR 0082, D10): every mark of the current database goes into the
/// restored one, and each restored account with a mark goes again, with the steps of <c>DELETE /v1/me</c> (ADR 0056,
/// D7) in an order a failure can resume: the modules erase first (<see cref="ErasureMode.AfterRestore"/>, nothing is
/// checked: the person already chose to go), then the user and the profile go. A second run finds nothing to do.
/// </summary>
internal sealed partial class ReapplyDeletionsHandler(
    IDeletionMarkSource source,
    IRestoredAccounts restored,
    IDeletedAccountStore deletedAccounts,
    IEnumerable<IAccountErasure> erasures,
    TimeProvider time,
    ILogger<ReapplyDeletionsHandler> logger)
{
    public async Task<Result<ReapplyDeletionsSummary>> HandleAsync(
        string sourceConnectionString, DateTimeOffset dumpCreatedAt, CancellationToken cancellationToken)
    {
        var started = time.GetTimestamp();
        if (!DeletionMarkRetention.Covers(dumpCreatedAt, time.GetUtcNow()))
        {
            return Result.Failure<ReapplyDeletionsSummary>(ReapplyDeletionsRefusals.DumpOlderThanRetention);
        }

        var marks = await source.ReadAllAsync(sourceConnectionString, cancellationToken).ConfigureAwait(false);
        var newMarks = await restored.CopyMarksAsync(marks, cancellationToken).ConfigureAwait(false);
        var accounts = await restored.FindMarkedAsync(cancellationToken).ConfigureAwait(false);
        // A group counts once, however many of its admins went (two admins of one group both marked, say).
        var groupsWithoutAdmin = new HashSet<Guid>();
        foreach (var account in accounts)
        {
            groupsWithoutAdmin.UnionWith(await EraseAsync(account, cancellationToken).ConfigureAwait(false));
        }

        var summary = new ReapplyDeletionsSummary(marks.Count, newMarks, accounts.Count, groupsWithoutAdmin.Count, time.GetElapsedTime(started));
        Reapplied(logger, summary.Marks, summary.NewMarks, summary.AccountsErased, summary.GroupsWithoutAdmin);
        return Result.Success(summary);
    }

    /// <summary>The groups left without an admin; the mark is there already, so the delete keeps its original date.</summary>
    private async Task<IReadOnlyList<Guid>> EraseAsync(MarkedAccount account, CancellationToken cancellationToken)
    {
        List<Guid> withoutAdmin = [];
        foreach (var erasure in erasures)
        {
            withoutAdmin.AddRange(await erasure.EraseAsync(account.User.Value, ErasureMode.AfterRestore, cancellationToken).ConfigureAwait(false));
        }

        await deletedAccounts.DeleteAsync(account.User, account.Subject, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        return withoutAdmin;
    }

    /// <summary>Only numbers: no login, hash, user, member or group id (ADR 0056, D11).</summary>
    [LoggerMessage(Level = LogLevel.Information, Message = "Deletions reapplied: {Marks} marks, {NewMarks} new marks, {Accounts} accounts erased, {GroupsWithoutAdmin} groups left without admin.")]
    private static partial void Reapplied(ILogger logger, int marks, int newMarks, int accounts, int groupsWithoutAdmin);
}
