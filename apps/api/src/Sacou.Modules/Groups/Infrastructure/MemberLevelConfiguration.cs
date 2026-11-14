using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Shared.Levels;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// <c>groups.member_levels</c>: the admin's private level, one row per member (ADR 0051, D2). Its own table, not
/// columns of <c>groups.members</c>, so no read of the member list can carry it. A null level is "Não sei". The
/// row stays when the member leaves: whoever comes back has the same member id and the same level. A new column
/// changes docs/seguranca/dados-pessoais.md and the model test.
/// </summary>
internal sealed class MemberLevelConfiguration : IEntityTypeConfiguration<MemberLevelRow>
{
    public const string Table = "member_levels";
    public const string LevelColumn = "level_tenths";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<MemberLevelRow> builder)
    {
        builder.ToTable(Table, table => table.HasCheckConstraint(
            "ck_member_levels_level",
            $"{LevelColumn} IS NULL OR ({LevelColumn} BETWEEN {SkillLevel.MinTenths} AND {SkillLevel.MaxTenths} AND {LevelColumn} % {SkillLevel.StepTenths} = 0)"));
        builder.HasKey(level => level.MemberId).HasName("pk_member_levels");
        builder.Property(level => level.MemberId).HasColumnName("member_id").ValueGeneratedNever();
        builder.Property(level => level.GroupId).HasColumnName("group_id");
        builder.Property(level => level.LevelTenths).HasColumnName(LevelColumn).HasColumnType("smallint");
        builder.Property(level => level.SetByMemberId).HasColumnName("set_by_member_id");
        builder.Property(level => level.SetAt).HasColumnName("set_at").HasColumnType(TimestampType);

        builder.HasOne<MemberRow>().WithOne().HasForeignKey<MemberLevelRow>(level => level.MemberId)
            .HasConstraintName("fk_member_levels_members").OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<GroupRow>().WithMany().HasForeignKey(level => level.GroupId)
            .HasConstraintName("fk_member_levels_groups").OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<MemberRow>().WithMany().HasForeignKey(level => level.SetByMemberId)
            .HasConstraintName("fk_member_levels_set_by").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(level => level.GroupId).HasDatabaseName("ix_member_levels_group");
        builder.HasIndex(level => level.SetByMemberId).HasDatabaseName("ix_member_levels_set_by_member_id");
    }
}
