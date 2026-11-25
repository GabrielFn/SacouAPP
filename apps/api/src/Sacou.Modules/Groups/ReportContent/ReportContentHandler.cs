using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Reports;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.ReportContent;

/// <summary>
/// A report of E6.6: the reported member must have a row in the group (any status), the reporter comes from the access
/// filter and never from the body. No group lock: a report changes nothing of the group, and a member row is never
/// deleted while its group lives. A new row writes one log line without any id or text, for the operator's alert
/// (question 234, docs/operacao/denuncias.md).
/// </summary>
internal sealed partial class ReportContentHandler(
    IGroupStore groups, IContentReportStore reports, TimeProvider time, ILogger<ReportContentHandler> logger)
{
    public async Task<Result<ContentReport>> HandleAsync(
        GroupId group, MemberId reporter, MemberId? reported, ContentReportReason reason, CancellationToken cancellationToken)
    {
        var targetInGroup = reported is { } target
            && (await groups.FindMembersOfGroupAsync(group, [target.Value], cancellationToken).ConfigureAwait(false)).Contains(target.Value);
        var report = ContentReport.Create(group, reporter, reported, targetInGroup, reason, time.GetUtcNow());
        if (report.IsFailure)
        {
            return report;
        }

        if (await reports.AddAsync(report.Value, cancellationToken).ConfigureAwait(false))
        {
            ContentReportReceived(logger);
        }

        return report;
    }

    /// <summary>The line the Cloud Logging alert matches (question 234). No group, member or reason: only that one arrived.</summary>
    [LoggerMessage(Level = LogLevel.Warning, Message = "Content report received.")]
    private static partial void ContentReportReceived(ILogger logger);
}
