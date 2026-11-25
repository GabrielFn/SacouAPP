using System.Data;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace Sacou.Modules.Matches.Infrastructure;

/// <summary>
/// The transaction of a court stream, bounded in time (ADR 0081, Part 2): the wait for the lock, each statement and the
/// transaction left idle. The database stops what passes them, the transaction rolls back, and the call is a 503
/// <c>matches.court-busy</c>: nothing written, the phone tries again.
/// </summary>
internal sealed partial class PostgresCourtStreamStore
{
    /// <summary>The SQLSTATE of a transaction ended for idling (Postgres 14 on), which Npgsql has no name for.</summary>
    private const string IdleInTransactionSessionTimeout = "25P03";

    /// <summary>
    /// <c>set_config(..., true)</c> is <c>SET LOCAL</c>, with the values as parameters: they last until the end of
    /// this transaction only, so the connection goes back to the pool as it came.
    /// </summary>
    private async Task<IDbContextTransaction> BeginBoundedTransactionAsync(CancellationToken cancellationToken)
    {
        var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
        var limits = transactionOptions.Value;
        _ = await database.Database.ExecuteSqlAsync(
            $"""
            SELECT set_config('lock_timeout', {Milliseconds(limits.LockTimeoutMilliseconds)}, true),
                   set_config('statement_timeout', {Milliseconds(limits.StatementTimeoutMilliseconds)}, true),
                   set_config('idle_in_transaction_session_timeout', {Milliseconds(limits.IdleInTransactionTimeoutMilliseconds)}, true)
            """,
            cancellationToken).ConfigureAwait(false);
        return transaction;
    }

    private static string Milliseconds(int value) => value.ToString(CultureInfo.InvariantCulture);

    /// <summary>
    /// The lock not had in time, a statement stopped by its timeout, or the transaction ended for idling. A request
    /// the caller canceled is an <see cref="OperationCanceledException"/> and never lands here.
    /// </summary>
    private static bool IsTimeout(Exception exception) =>
        (exception as PostgresException ?? exception.InnerException as PostgresException)?.SqlState
            is PostgresErrorCodes.LockNotAvailable or PostgresErrorCodes.QueryCanceled or IdleInTransactionSessionTimeout;
}
