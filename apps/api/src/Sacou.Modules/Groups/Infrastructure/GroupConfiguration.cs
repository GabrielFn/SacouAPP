using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Groups.Domain.Groups;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// <c>groups.groups</c>: id, name and creation time. 60 text elements fit in 240 code points, which the
/// domain also enforces; the fine rule is the domain's (ADR 0040, D6).
/// </summary>
internal sealed class GroupConfiguration : IEntityTypeConfiguration<GroupRow>
{
    public const string Table = "groups";
    public const string NameLengthCheck = "ck_groups_name_length";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<GroupRow> builder)
    {
        builder.ToTable(Table, table => table.HasCheckConstraint(
            NameLengthCheck, $"char_length(name) BETWEEN 1 AND {GroupName.MaxCodePoints}"));
        builder.HasKey(group => group.Id).HasName("pk_groups");
        builder.Property(group => group.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(group => group.Name).HasColumnName("name").HasColumnType("text");
        builder.Property(group => group.CreatedAt).HasColumnName("created_at").HasColumnType(TimestampType);
    }
}
