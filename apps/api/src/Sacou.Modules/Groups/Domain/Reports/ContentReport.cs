using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Reports;

/// <summary>
/// Why someone reports a member or the group (E6.6, question 233): a closed list, never free text, so the report
/// holds no personal data and no copy of the offending text.
/// </summary>
internal enum ContentReportReason
{
    OffensiveName,
    HateOrSexual,
    Impersonation,
    Spam,
}

/// <summary>
/// A report of a member's name (<see cref="Reported"/>) or of the group's name and venue (<see cref="Reported"/> null).
/// Only ids: the reporter is never shown to anyone in the app (E6.6).
/// </summary>
internal sealed record ContentReport(
    Guid Id, GroupId GroupId, MemberId Reporter, MemberId? Reported, ContentReportReason Reason, DateTimeOffset CreatedAt)
{
    /// <summary>How long a report is kept before the daily sweep deletes it (question 234).</summary>
    public static readonly TimeSpan Retention = TimeSpan.FromDays(180);

    /// <summary>
    /// The rules of a report: nobody reports themselves (<c>groups.report-self</c>), and a reported member must have a row
    /// in this group, in any status (<paramref name="targetInGroup"/>; one who left still shows in the history). A member of
    /// another group, or an id of nobody, is <c>groups.member-not-found</c>.
    /// </summary>
    public static Result<ContentReport> Create(
        GroupId group, MemberId reporter, MemberId? reported, bool targetInGroup, ContentReportReason reason, DateTimeOffset now)
    {
        if (reported == reporter)
        {
            return Result.Failure<ContentReport>(GroupErrors.ReportSelf);
        }

        if (reported is not null && !targetInGroup)
        {
            return Result.Failure<ContentReport>(GroupErrors.MemberNotFound);
        }

        return Result.Success(new ContentReport(Guid.CreateVersion7(now), group, reporter, reported, reason, now));
    }
}
