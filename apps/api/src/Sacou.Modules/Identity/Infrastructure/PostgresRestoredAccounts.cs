using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.ReapplyDeletions;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>The restored database through the API's own context (E6.3): parameterized statements only.</summary>
internal sealed class PostgresRestoredAccounts(IdentityDbContext database) : IRestoredAccounts
{
    /// <summary>Every mark in one statement; a mark already there keeps its date (ADR 0056, D5).</summary>
    private const string CopyMarks =
        "INSERT INTO identity.deleted_accounts (subject_hash, deleted_at) SELECT * FROM unnest(@hashes, @deleted_at) " +
        "ON CONFLICT (subject_hash) DO NOTHING";

    public async Task<int> CopyMarksAsync(IReadOnlyList<DeletionMark> marks, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(marks);
        if (marks.Count == 0)
        {
            return 0;
        }

        object[] parameters =
        [
            new NpgsqlParameter("hashes", NpgsqlDbType.Array | NpgsqlDbType.Bytea) { Value = marks.Select(mark => mark.SubjectHash).ToArray() },
            new NpgsqlParameter("deleted_at", NpgsqlDbType.Array | NpgsqlDbType.TimestampTz) { Value = marks.Select(mark => mark.DeletedAt).ToArray() },
        ];
        return await database.Database.ExecuteSqlRawAsync(CopyMarks, parameters, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>The same bytes as <see cref="SubjectHash.Of"/>: SHA-256 of the login in UTF-8 (door 3, a golden test holds them equal).</summary>
    public async Task<IReadOnlyList<MarkedAccount>> FindMarkedAsync(CancellationToken cancellationToken)
    {
        var rows = await database.Database.SqlQuery<MarkedRow>(
                $"""
                SELECT id AS "Id", firebase_uid AS "Subject" FROM identity.users
                WHERE sha256(convert_to(firebase_uid, 'UTF8')) IN (SELECT subject_hash FROM identity.deleted_accounts)
                """)
            .OrderBy(row => row.Id).ToListAsync(cancellationToken).ConfigureAwait(false);
        return [.. rows.Select(ToAccount)];
    }

    private static MarkedAccount ToAccount(MarkedRow row)
    {
        var subject = AuthSubject.Create(row.Subject);
        return subject.IsSuccess
            ? new MarkedAccount(new UserId(row.Id), subject.Value)
            : throw new InvalidOperationException("A stored login is not a valid subject.");
    }

    /// <summary>The shape of the query, by column name.</summary>
    internal sealed class MarkedRow
    {
        public Guid Id { get; init; }

        public string Subject { get; init; } = string.Empty;
    }
}
