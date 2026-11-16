using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// <c>identity.deleted_accounts</c>, the tombstone of a deleted account (ADR 0056, D5): two columns and nothing else,
/// so a deleted login cannot sign in again and create a new account. Kept until E6.2 decides the retention. A new
/// column changes docs/seguranca/dados-pessoais.md and the model test.
/// </summary>
internal sealed class DeletedAccountConfiguration : IEntityTypeConfiguration<DeletedAccountRow>
{
    public const string Table = "deleted_accounts";
    public const string SubjectHashColumn = "subject_hash";
    public const string DeletedAtColumn = "deleted_at";
    public const string PrimaryKey = "pk_deleted_accounts";
    public const string HashLengthCheck = "ck_deleted_accounts_subject_hash_length";

    public void Configure(EntityTypeBuilder<DeletedAccountRow> builder)
    {
        builder.ToTable(Table, table => table.HasCheckConstraint(
            HashLengthCheck, $"octet_length({SubjectHashColumn}) = {Infrastructure.SubjectHash.Length}"));
        builder.HasKey(row => row.SubjectHash).HasName(PrimaryKey);
        builder.Property(row => row.SubjectHash).HasColumnName(SubjectHashColumn).HasColumnType("bytea").ValueGeneratedNever();
        builder.Property(row => row.DeletedAt).HasColumnName(DeletedAtColumn).HasColumnType("timestamp with time zone").IsRequired();
    }
}
