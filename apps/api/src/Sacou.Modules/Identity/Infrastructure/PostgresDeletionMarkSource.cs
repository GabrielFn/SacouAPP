using Npgsql;
using Sacou.Modules.Identity.ReapplyDeletions;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// The current database, through the backup's read-only role (E6.3, door 2): one connection of its own, outside the API's
/// pool, and a <c>READ ONLY</c> transaction, so not even a bug here can write to it.
/// </summary>
internal sealed class PostgresDeletionMarkSource : IDeletionMarkSource
{
    private const string ReadOnly = "SET TRANSACTION READ ONLY";

    private const string SelectMarks =
        $"SELECT {DeletedAccountConfiguration.SubjectHashColumn}, {DeletedAccountConfiguration.DeletedAtColumn} " +
        $"FROM {IdentityDbContext.Schema}.{DeletedAccountConfiguration.Table} ORDER BY {DeletedAccountConfiguration.SubjectHashColumn}";

    public async Task<IReadOnlyList<DeletionMark>> ReadAllAsync(string connectionString, CancellationToken cancellationToken)
    {
        var withoutPool = new NpgsqlConnectionStringBuilder(connectionString) { Pooling = false }.ConnectionString;
        var connection = new NpgsqlConnection(withoutPool);
        await using (connection.ConfigureAwait(false))
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            var transaction = await connection.BeginTransactionAsync(cancellationToken).ConfigureAwait(false);
            await using (transaction.ConfigureAwait(false))
            {
                var readOnly = new NpgsqlCommand(ReadOnly, connection, transaction);
                await using (readOnly.ConfigureAwait(false))
                {
                    _ = await readOnly.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
                }

                var marks = await ReadMarksAsync(connection, transaction, cancellationToken).ConfigureAwait(false);
                await transaction.RollbackAsync(cancellationToken).ConfigureAwait(false);
                return marks;
            }
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
