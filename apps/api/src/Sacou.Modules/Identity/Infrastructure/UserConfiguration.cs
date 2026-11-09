using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// <c>identity.users</c>: three columns and nothing else (ADR 0036, D5). A new column changes
/// docs/seguranca/dados-pessoais.md and the model test.
/// </summary>
internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public const string Table = "users";
    public const string IdColumn = "id";
    public const string SubjectColumn = "firebase_uid";
    public const string CreatedAtColumn = "created_at";
    public const string SubjectIndex = "ux_users_firebase_uid";
    public const string SubjectLengthCheck = "ck_users_firebase_uid_length";

    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable(Table, table => table.HasCheckConstraint(
            SubjectLengthCheck, $"char_length({SubjectColumn}) BETWEEN 1 AND {AuthSubject.MaxLength}"));
        builder.HasKey(user => user.Id).HasName("pk_users");

        builder.Property(user => user.Id)
            .HasColumnName(IdColumn)
            .HasConversion(id => id.Value, value => new UserId(value))
            .ValueGeneratedNever();

        builder.Property(user => user.Subject)
            .HasColumnName(SubjectColumn)
            .HasColumnType("text")
            .HasConversion(subject => subject.Value, value => AuthSubject.Create(value).Value)
            .IsRequired();

        builder.Property(user => user.CreatedAt)
            .HasColumnName(CreatedAtColumn)
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.HasIndex(user => user.Subject).IsUnique().HasDatabaseName(SubjectIndex);
    }
}
