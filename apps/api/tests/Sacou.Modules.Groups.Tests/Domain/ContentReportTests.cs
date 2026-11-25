using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Reports;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>E6.6, criteria 6 to 8 and 14: who may be reported, from the rule's side (the route has its own tests).</summary>
public sealed class ContentReportTests
{
    private static readonly GroupId Group = new(Guid.NewGuid());
    private static readonly MemberId Reporter = new(Guid.NewGuid());
    private static readonly MemberId Target = new(Guid.NewGuid());

    [Fact]
    public void AMemberOfTheGroup_IsReported_WithOnlyIds()
    {
        var report = ContentReport.Create(Group, Reporter, Target, targetInGroup: true, ContentReportReason.Impersonation, GroupBuilder.Now);

        Assert.True(report.IsSuccess);
        Assert.Equal(Group, report.Value.GroupId);
        Assert.Equal(Reporter, report.Value.Reporter);
        Assert.Equal(Target, report.Value.Reported);
        Assert.Equal(ContentReportReason.Impersonation, report.Value.Reason);
        Assert.Equal(GroupBuilder.Now, report.Value.CreatedAt);
        Assert.Equal(7, report.Value.Id.Version);
    }

    [Fact]
    public void TheGroup_IsReported_WithoutAMember()
    {
        var report = ContentReport.Create(Group, Reporter, null, targetInGroup: false, ContentReportReason.HateOrSexual, GroupBuilder.Now);

        Assert.True(report.IsSuccess);
        Assert.Null(report.Value.Reported);
    }

    [Fact]
    public void Oneself_IsRefused_AsReportSelf()
    {
        var report = ContentReport.Create(Group, Reporter, Reporter, targetInGroup: true, ContentReportReason.Spam, GroupBuilder.Now);

        Assert.Equal("groups.report-self", report.Error.Code);
    }

    [Fact]
    public void AMemberOutsideTheGroup_IsNotFound()
    {
        var report = ContentReport.Create(Group, Reporter, Target, targetInGroup: false, ContentReportReason.OffensiveName, GroupBuilder.Now);

        Assert.Equal("groups.member-not-found", report.Error.Code);
    }

    [Fact]
    public void Retention_Is180Days()
    {
        Assert.Equal(TimeSpan.FromDays(180), ContentReport.Retention);
    }
}
