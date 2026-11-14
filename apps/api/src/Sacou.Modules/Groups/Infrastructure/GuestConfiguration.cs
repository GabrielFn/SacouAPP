using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Shared.Persistence;
using Sacou.Shared.Text;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// <c>groups.guests</c>: the profile of a guest without an account, one row per member (ADR 0053, D2). Its own table,
/// so the columns of <c>groups.members</c> never carry a name. The row is deleted when the guest is removed (D9), and
/// it follows its member and its group: deleting either deletes it, so a later deletion of the group (E3.16) never
/// stops on this table. A new column changes docs/seguranca/dados-pessoais.md and the model test.
/// </summary>
internal sealed class GuestConfiguration : IEntityTypeConfiguration<GuestRow>
{
    public const string Table = "guests";
    public const string RequestIndex = "ux_guests_group_request";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<GuestRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_guests_primary_position", $"primary_position IS NULL OR primary_position IN ({EnumColumns.SqlList(GuestPositions.Names)})");
            table.HasCheckConstraint("ck_guests_name", $"char_length(name) BETWEEN 1 AND {PersonName.MaxCodePoints}");
        });
        builder.HasKey(guest => guest.MemberId).HasName("pk_guests");
        builder.Property(guest => guest.MemberId).HasColumnName("member_id").ValueGeneratedNever();
        builder.Property(guest => guest.GroupId).HasColumnName("group_id");
        builder.Property(guest => guest.Name).HasColumnName("name").HasColumnType("text");
        builder.Property(guest => guest.PrimaryPosition).HasColumnName("primary_position").HasColumnType("text");
        builder.Property(guest => guest.RequestId).HasColumnName("request_id");
        builder.Property(guest => guest.CreatedAt).HasColumnName("created_at").HasColumnType(TimestampType);

        builder.HasOne<MemberRow>().WithOne().HasForeignKey<GuestRow>(guest => guest.MemberId)
            .HasConstraintName("fk_guests_members").OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<GroupRow>().WithMany().HasForeignKey(guest => guest.GroupId)
            .HasConstraintName("fk_guests_groups").OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(guest => new { guest.GroupId, guest.RequestId }).IsUnique().HasDatabaseName(RequestIndex);
    }
}
