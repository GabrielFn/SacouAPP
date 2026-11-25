namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>A row of <c>groups.content_reports</c>: six columns, only ids and a closed reason (E6.6, door 1).</summary>
internal sealed class ContentReportRow
{
    public required Guid Id { get; init; }

    public required Guid GroupId { get; init; }

    public required Guid ReporterMemberId { get; init; }

    /// <summary>Null: the report is about the group (its name or venue), not a member.</summary>
    public Guid? ReportedMemberId { get; init; }

    public required string Reason { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }
}
