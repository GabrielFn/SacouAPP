using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// <c>groups.members</c>. One <c>MemberId</c> per person per group, for ever: the partial unique index
/// covers people who left too. No foreign key to <c>identity.users</c>: a module never ties itself to
/// another module's table (ADR 0040, D6).
/// </summary>
internal sealed class MemberConfiguration : IEntityTypeConfiguration<MemberRow>
{
    public const string Table = "members";
    public const string GroupUserIndex = "ux_members_group_user";
    public const string ActiveUserIndex = "ix_members_user";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<MemberRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_members_role", $"role IN ({ColumnValues.SqlList(ColumnValues.Roles)})");
            table.HasCheckConstraint("ck_members_member_type", $"member_type IN ({ColumnValues.SqlList(ColumnValues.MemberTypes)})");
            table.HasCheckConstraint("ck_members_status", $"status IN ({ColumnValues.SqlList(ColumnValues.Statuses)})");
            table.HasCheckConstraint("ck_members_left_at", $"(status = '{ColumnValues.ActiveStatus}') = (left_at IS NULL)");
        });
        builder.HasKey(member => member.Id).HasName("pk_members");
        builder.Property(member => member.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(member => member.GroupId).HasColumnName("group_id");
        builder.Property(member => member.UserId).HasColumnName("user_id");
        builder.Property(member => member.Role).HasColumnName("role").HasColumnType("text");
        builder.Property(member => member.MemberType).HasColumnName("member_type").HasColumnType("text");
        builder.Property(member => member.Status).HasColumnName("status").HasColumnType("text");
        builder.Property(member => member.JoinedAt).HasColumnName("joined_at").HasColumnType(TimestampType);
        builder.Property(member => member.LeftAt).HasColumnName("left_at").HasColumnType(TimestampType);

        builder.HasOne<GroupRow>().WithMany().HasForeignKey(member => member.GroupId)
            .HasConstraintName("fk_members_groups").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(member => member.GroupId).HasDatabaseName("ix_members_group_id");
        builder.HasIndex(member => new { member.GroupId, member.UserId }).IsUnique()
            .HasFilter("user_id IS NOT NULL").HasDatabaseName(GroupUserIndex);
        builder.HasIndex(member => member.UserId)
            .HasFilter($"status = '{ColumnValues.ActiveStatus}'").HasDatabaseName(ActiveUserIndex);
    }
}
