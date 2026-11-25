using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Shared.Persistence;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// <c>groups.content_reports</c> (E6.6, doors 1 and 2): who reported, whom (null for the group), why and when. No text,
/// no copy of the reported name. The same report twice is one row (<see cref="OnceIndex"/>, nulls not distinct, so the
/// group's report repeats once too). It follows its group and its members by cascade; the account erasure deletes the
/// reports by and about the person, and the daily sweep the old ones. A new column changes
/// docs/seguranca/dados-pessoais.md and the model test.
/// </summary>
internal sealed class ContentReportConfiguration : IEntityTypeConfiguration<ContentReportRow>
{
    public const string Table = "content_reports";
    public const string OnceIndex = "ux_content_reports_once";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<ContentReportRow> builder)
    {
        builder.ToTable(Table, table => table.HasCheckConstraint(
            "ck_content_reports_reason", $"reason IN ({EnumColumns.SqlList(ColumnValues.ReportReasons)})"));
        builder.HasKey(report => report.Id).HasName("pk_content_reports");
        builder.Property(report => report.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(report => report.GroupId).HasColumnName("group_id");
        builder.Property(report => report.ReporterMemberId).HasColumnName("reporter_member_id");
        builder.Property(report => report.ReportedMemberId).HasColumnName("reported_member_id");
        builder.Property(report => report.Reason).HasColumnName("reason").HasColumnType("text");
        builder.Property(report => report.CreatedAt).HasColumnName("created_at").HasColumnType(TimestampType);

        builder.HasOne<GroupRow>().WithMany().HasForeignKey(report => report.GroupId)
            .HasConstraintName("fk_content_reports_groups").OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<MemberRow>().WithMany().HasForeignKey(report => report.ReporterMemberId)
            .HasConstraintName("fk_content_reports_reporter").OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<MemberRow>().WithMany().HasForeignKey(report => report.ReportedMemberId)
            .HasConstraintName("fk_content_reports_reported").OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(report => new { report.GroupId, report.ReporterMemberId, report.ReportedMemberId, report.Reason })
            .IsUnique().AreNullsDistinct(false).HasDatabaseName(OnceIndex);
        builder.HasIndex(report => report.ReporterMemberId).HasDatabaseName("ix_content_reports_reporter");
        builder.HasIndex(report => report.ReportedMemberId).HasDatabaseName("ix_content_reports_reported");
        builder.HasIndex(report => report.CreatedAt).HasDatabaseName("ix_content_reports_created_at");
    }
}
