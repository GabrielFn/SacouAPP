using System.Data.Common;
using Npgsql;
using Sacou.Modules.Identity.ReapplyDeletions;
using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// The current database, through the backup's read-only role (E6.3, door 2): one connection of its own, outside the API's
/// pool, and a <c>READ ONLY</c> transaction, so not even a bug here can write to it. A role that could write is refused
/// before any mark is read (S2): it is the API's credential, the one the restore must never hold twice.
/// </summary>
internal sealed class PostgresDeletionMarkSource : IDeletionMarkSource
{
    private const string ReadOnly = "SET TRANSACTION READ ONLY";

    private const string Writes = "INSERT, UPDATE, DELETE";

    private const string Users = $"{IdentityDbContext.Schema}.{UserConfiguration.Table}";

    private const string Marks = $"{IdentityDbContext.Schema}.{DeletedAccountConfiguration.Table}";

    /// <summary>True when the role may write either table; a superuser or <c>pg_write_all_data</c> counts too.</summary>
    private const string CanWrite =
        $"SELECT has_table_privilege(current_user, '{Users}', '{Writes}') OR has_table_privilege(current_user, '{Marks}', '{Writes}')";

    private const string SelectMarks =
        $"SELECT {DeletedAccountConfiguration.SubjectHashColumn}, {DeletedAccountConfiguration.DeletedAtColumn} " +
        $"FROM {Marks} ORDER BY {DeletedAccountConfiguration.SubjectHashColumn}";

    public async Task<Result<IReadOnlyList<DeletionMark>>> ReadAllAsync(string connectionString, CancellationToken cancellationToken)
    {
        try
        {
            return await ReadAsync(connectionString, cancellationToken).ConfigureAwait(false);
        }
        catch (DbException)
        {
            // No connection, a wrong password, no permission or no table: only the code goes out, never the message,
            // which may name the host.
            return Result.Failure<IReadOnlyList<DeletionMark>>(ReapplyDeletionsRefusals.SourceUnreadable);
        }
    }

    private static async Task<Result<IReadOnlyList<DeletionMark>>> ReadAsync(string connectionString, CancellationToken cancellationToken)
    {
        var withoutPool = new NpgsqlConnectionStringBuilder(connectionString) { Pooling = false }.ConnectionString;
        var connection = new NpgsqlConnection(withoutPool);
        await using (connection.ConfigureAwait(false))
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            var transaction = await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
            await using (transaction.ConfigureAwait(false))
            {
                _ = await ScalarAsync(ReadOnly, connection, transaction, cancellationToken).ConfigureAwait(false);
                if (await ScalarAsync(CanWrite, connection, transaction, cancellationToken).ConfigureAwait(false) is true)
                {
                    await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                    return Result.Failure<IReadOnlyList<DeletionMark>>(ReapplyDeletionsRefusals.SourceCanWrite);
                }

                var marks = await ReadMarksAsync(connection, transaction, cancellationToken).ConfigureAwait(false);
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                return Result.Success(marks);
            }
        }
    }

    private static async Task<object?> ScalarAsync(
        string sql, NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        var command = new NpgsqlCommand(sql, connection, transaction);
        await using (command.ConfigureAwait(false))
        {
            return await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private static async Task<IReadOnlyList<DeletionMark>> ReadMarksAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, CancellationToken cancellationToken)
    {
        var select = new NpgsqlCommand(SelectMarks, connection, transaction);
        await using (select.ConfigureAwait(false))
        {
            var reader = await select.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            await using (reader.ConfigureAwait(false))
            {
                var marks = new List<DeletionMark>();
                while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
                {
                    marks.Add(new DeletionMark(reader.GetFieldValue<byte[]>(0), reader.GetFieldValue<DateTimeOffset>(1)));
                }

                return marks;
            }
        }
    }
}
