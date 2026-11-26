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
    /// A report of a member's name. Nobody reports themselves (<c>groups.report-self</c>), and the reported member must
    /// have a row in this group, in any status (one who left still shows in the history): <paramref name="groupMembers"/>
    /// holds the ids of this group the store found. A member of another group, or an id of nobody, is
    /// <c>groups.member-not-found</c>.
    /// </summary>
    public static Result<ContentReport> ForMember(
        GroupId group, MemberId reporter, MemberId reported, IReadOnlySet<Guid> groupMembers, ContentReportReason reason, DateTimeOffset now)
    {
        if (reported == reporter)
        {
            return Result.Failure<ContentReport>(GroupErrors.ReportSelf);
        }

        if (!groupMembers.Contains(reported.Value))
        {
            return Result.Failure<ContentReport>(GroupErrors.MemberNotFound);
        }

        return Result.Success(New(group, reporter, reported, reason, now));
    }

    /// <summary>A report of the group's name and venue: any active member may make it, so it never fails.</summary>
    public static ContentReport ForGroup(GroupId group, MemberId reporter, ContentReportReason reason, DateTimeOffset now) =>
        New(group, reporter, null, reason, now);

    private static ContentReport New(GroupId group, MemberId reporter, MemberId? reported, ContentReportReason reason, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), group, reporter, reported, reason, now);
}
