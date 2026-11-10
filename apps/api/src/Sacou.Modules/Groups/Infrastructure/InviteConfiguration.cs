using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// <c>groups.invites</c>, created with the other tables so E3.2 has a single migration. Only the 32-byte
/// SHA-256 of the token, behind a unique index (ADR 0040, D10).
/// </summary>
internal sealed class InviteConfiguration : IEntityTypeConfiguration<InviteRow>
{
    public const string Table = "invites";
    public const int TokenHashLength = Domain.Invites.InviteTokenHash.Length;

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<InviteRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_invites_token_hash_length", $"octet_length(token_hash) = {TokenHashLength}");
            table.HasCheckConstraint("ck_invites_use_count", "use_count >= 0");
        });
        builder.HasKey(invite => invite.Id).HasName("pk_invites");
        builder.Property(invite => invite.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(invite => invite.GroupId).HasColumnName("group_id");
        builder.Property(invite => invite.TokenHash).HasColumnName("token_hash").HasColumnType("bytea");
        builder.Property(invite => invite.CreatedByMemberId).HasColumnName("created_by_member_id");
        builder.Property(invite => invite.CreatedAt).HasColumnName("created_at").HasColumnType(TimestampType);
        builder.Property(invite => invite.ExpiresAt).HasColumnName("expires_at").HasColumnType(TimestampType);
        builder.Property(invite => invite.RevokedAt).HasColumnName("revoked_at").HasColumnType(TimestampType);
        builder.Property(invite => invite.UseCount).HasColumnName("use_count").HasDefaultValue(0);

        builder.HasOne<GroupRow>().WithMany().HasForeignKey(invite => invite.GroupId)
            .HasConstraintName("fk_invites_groups").OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<MemberRow>().WithMany().HasForeignKey(invite => invite.CreatedByMemberId)
            .HasConstraintName("fk_invites_members").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(invite => invite.TokenHash).IsUnique().HasDatabaseName("ux_invites_token_hash");
        builder.HasIndex(invite => invite.GroupId).HasDatabaseName("ix_invites_group_id");
        builder.HasIndex(invite => invite.CreatedByMemberId).HasDatabaseName("ix_invites_created_by_member_id");
    }
}
