using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Reports;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>Where the reports of E6.6 live. Nothing here reads them back: the operator reads the table by SQL (docs/operacao/denuncias.md).</summary>
internal interface IContentReportStore
{
    /// <summary>
    /// Writes the report once: the same report again (same group, reporter, target and reason) writes nothing and is no
    /// error (door 2). True when the row is new.
    /// </summary>
    Task<bool> AddAsync(ContentReport report, CancellationToken cancellationToken);
}

/// <summary>
/// Parameterized SQL, as every write of the module: <c>ON CONFLICT DO NOTHING</c> on <see cref="ContentReportConfiguration.OnceIndex"/>.
/// The cleanup deletes in batches of <see cref="CleanUpBatchSize"/>, so one call never holds a long lock.
/// </summary>
internal sealed class PostgresContentReportStore(GroupsDbContext database) : IContentReportStore, IContentReportRetention
{
    public const int CleanUpBatchSize = 500;

    public async Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var before = now - ContentReport.Retention;
        int deleted;
        do
        {
            deleted = await database.Database.ExecuteSqlAsync(
                $"""
                DELETE FROM groups.content_reports WHERE id IN (
                    SELECT id FROM groups.content_reports WHERE created_at < {before} LIMIT {CleanUpBatchSize})
                """,
                cancellationToken).ConfigureAwait(false);
        }
        while (deleted == CleanUpBatchSize && !cancellationToken.IsCancellationRequested);
    }

    public async Task<bool> AddAsync(ContentReport report, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(report);
        var reason = ColumnValues.ReportReasons[report.Reason];
        var written = await database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO groups.content_reports (id, group_id, reporter_member_id, reported_member_id, reason, created_at)
            VALUES ({report.Id}, {report.GroupId.Value}, {report.Reporter.Value}, {report.Reported?.Value}, {reason}, {report.CreatedAt})
            ON CONFLICT (group_id, reporter_member_id, reported_member_id, reason) DO NOTHING
            """,
            cancellationToken).ConfigureAwait(false);
        return written > 0;
    }
}
