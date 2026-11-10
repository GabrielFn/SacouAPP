using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Domain.Templates;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>
/// <c>groups.group_settings</c> (one row per group). The CHECKs hold the shape the parser also enforces: an
/// object of at most 8 KiB and a known schema version (ADR 0041, D5). <c>saved_template_id</c> has no
/// foreign key on purpose: deleting a template clears it in the same transaction.
/// </summary>
internal sealed class GroupSettingsConfiguration : IEntityTypeConfiguration<GroupSettingsRow>
{
    public const string Table = "group_settings";
    public const int MaxDocumentBytes = 8192;
    public static readonly string DocumentRule = $"jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= {MaxDocumentBytes}";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<GroupSettingsRow> builder)
    {
        var templateKeys = string.Join(", ", SettingsCatalog.TemplateKeys.Select(key => $"'{key}'"));
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_group_settings_schema_version", $"schema_version = {SettingsCatalog.SchemaVersion}");
            table.HasCheckConstraint("ck_group_settings_document", DocumentRule);
            table.HasCheckConstraint("ck_group_settings_template_key", $"template_key IN ({templateKeys})");
            table.HasCheckConstraint("ck_group_settings_one_template", "NOT (template_key IS NOT NULL AND saved_template_id IS NOT NULL)");
        });
        builder.HasKey(row => row.GroupId).HasName("pk_group_settings");
        builder.Property(row => row.GroupId).HasColumnName("group_id").ValueGeneratedNever();
        builder.Property(row => row.SchemaVersion).HasColumnName("schema_version");
        builder.Property(row => row.Settings).HasColumnName("settings").HasColumnType("jsonb");
        builder.Property(row => row.TemplateKey).HasColumnName("template_key").HasColumnType("text");
        builder.Property(row => row.SavedTemplateId).HasColumnName("saved_template_id");
        builder.Property(row => row.UpdatedAt).HasColumnName("updated_at").HasColumnType(TimestampType);
        builder.Property(row => row.UpdatedByMemberId).HasColumnName("updated_by_member_id");

        builder.HasOne<GroupRow>().WithMany().HasForeignKey(row => row.GroupId)
            .HasConstraintName("fk_group_settings_groups").OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<MemberRow>().WithMany().HasForeignKey(row => row.UpdatedByMemberId)
            .HasConstraintName("fk_group_settings_members").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(row => row.UpdatedByMemberId).HasDatabaseName("ix_group_settings_updated_by_member_id");
    }
}

/// <summary><c>groups.saved_templates</c>: always read by <c>(group_id, id)</c>, never by a bare id (IDOR, ADR 0041).</summary>
internal sealed class SavedTemplateConfiguration : IEntityTypeConfiguration<SavedTemplateRow>
{
    public const string Table = "saved_templates";

    private const string TimestampType = "timestamp with time zone";

    public void Configure(EntityTypeBuilder<SavedTemplateRow> builder)
    {
        builder.ToTable(Table, table =>
        {
            table.HasCheckConstraint("ck_saved_templates_name_length", $"char_length(name) BETWEEN 1 AND {TemplateName.MaxCodePoints}");
            table.HasCheckConstraint("ck_saved_templates_schema_version", $"schema_version = {SettingsCatalog.SchemaVersion}");
            table.HasCheckConstraint("ck_saved_templates_document", GroupSettingsConfiguration.DocumentRule);
        });
        builder.HasKey(row => row.Id).HasName("pk_saved_templates");
        builder.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(row => row.GroupId).HasColumnName("group_id");
        builder.Property(row => row.Name).HasColumnName("name").HasColumnType("text");
        builder.Property(row => row.SchemaVersion).HasColumnName("schema_version");
        builder.Property(row => row.Settings).HasColumnName("settings").HasColumnType("jsonb");
        builder.Property(row => row.CreatedAt).HasColumnName("created_at").HasColumnType(TimestampType);
        builder.Property(row => row.CreatedByMemberId).HasColumnName("created_by_member_id");

        builder.HasOne<GroupRow>().WithMany().HasForeignKey(row => row.GroupId)
            .HasConstraintName("fk_saved_templates_groups").OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<MemberRow>().WithMany().HasForeignKey(row => row.CreatedByMemberId)
            .HasConstraintName("fk_saved_templates_members").OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(row => row.GroupId).HasDatabaseName("ix_saved_templates_group");
        builder.HasIndex(row => row.CreatedByMemberId).HasDatabaseName("ix_saved_templates_created_by_member_id");
    }
}
