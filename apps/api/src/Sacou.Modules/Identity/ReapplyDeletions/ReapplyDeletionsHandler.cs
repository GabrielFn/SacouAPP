using System.Data.Common;
using Microsoft.EntityFrameworkCore;
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
/// Before any write, the source must be readable, read only, and not older than the restored database (S2).
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
        var now = time.GetUtcNow();
        if (!DeletionMarkRetention.Covers(dumpCreatedAt, now))
        {
            return Result.Failure<ReapplyDeletionsSummary>(ReapplyDeletionsRefusals.DumpOlderThanRetention);
        }

        var read = await source.ReadAllAsync(sourceConnectionString, cancellationToken).ConfigureAwait(false);
        if (read.IsFailure)
        {
            return Result.Failure<ReapplyDeletionsSummary>(read.Error);
        }

        var marks = read.Value;
        if (await restored.CountMarksMissingFromAsync(marks, now - DeletionMarkRetention.Period, cancellationToken).ConfigureAwait(false) > 0)
        {
            return Result.Failure<ReapplyDeletionsSummary>(ReapplyDeletionsRefusals.TargetAheadOfSource);
        }

        var newMarks = await restored.CopyMarksAsync(marks, cancellationToken).ConfigureAwait(false);
        var accounts = await restored.FindMarkedAsync(cancellationToken).ConfigureAwait(false);
        // A group counts once, however many of its admins went (two admins of one group both marked, say).
        var groupsWithoutAdmin = new HashSet<Guid>();
        var erased = 0;
        foreach (var account in accounts)
        {
            var erasure = await TryEraseAsync(account, cancellationToken).ConfigureAwait(false);
            if (erasure.IsFailure)
            {
                Interrupted(logger, erased, accounts.Count, erasure.Error.Code);
                break;
            }

            groupsWithoutAdmin.UnionWith(erasure.Value);
            erased++;
        }

        var summary = new ReapplyDeletionsSummary(marks.Count, newMarks, erased, accounts.Count, groupsWithoutAdmin.Count, time.GetElapsedTime(started));
        Reapplied(logger, summary.Marks, summary.NewMarks, summary.AccountsErased, summary.AccountsFound, summary.GroupsWithoutAdmin);
        return Result.Success(summary);
    }

    /// <summary>
    /// A database failure stops the run where it is (criterion 14): the account is left for the next run, which finds it
    /// by its mark again. Only the exception's type is logged: its message may hold a key's value.
    /// </summary>
    private async Task<Result<IReadOnlyList<Guid>>> TryEraseAsync(MarkedAccount account, CancellationToken cancellationToken)
    {
        try
        {
            return Result.Success(await EraseAsync(account, cancellationToken).ConfigureAwait(false));
        }
        catch (DbException exception)
        {
            return Failed(exception);
        }
        catch (DbUpdateException exception)
        {
            return Failed(exception);
        }
    }

    private Result<IReadOnlyList<Guid>> Failed(Exception exception)
    {
        EraseFailed(logger, exception.GetType().Name);
        return Result.Failure<IReadOnlyList<Guid>>(ReapplyDeletionsRefusals.Interrupted);
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
    [LoggerMessage(Level = LogLevel.Information, Message = "Deletions reapplied: {Marks} marks, {NewMarks} new marks, {Accounts} of {Found} accounts erased, {GroupsWithoutAdmin} groups left without admin.")]
    private static partial void Reapplied(ILogger logger, int marks, int newMarks, int accounts, int found, int groupsWithoutAdmin);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Deletions reapply interrupted after {Erased} of {Found} accounts ({Code}); running again resumes it.")]
    private static partial void Interrupted(ILogger logger, int erased, int found, string code);

    [LoggerMessage(Level = LogLevel.Warning, Message = "An account erasure of the reapply failed ({ExceptionType}).")]
    private static partial void EraseFailed(ILogger logger, string exceptionType);
}
