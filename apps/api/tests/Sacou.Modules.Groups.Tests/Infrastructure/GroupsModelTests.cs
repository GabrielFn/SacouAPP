using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Sacou.Modules.Groups.Infrastructure;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Infrastructure;

/// <summary>P2 and P3: the model matches the migration snapshot, and each table holds exactly its columns.</summary>
public sealed class GroupsModelTests : IDisposable
{
    private readonly GroupsDbContext context = new GroupsDesignTimeFactory().CreateDbContext([]);

    [Fact]
    public void Model_HasNoChangesWithoutAMigration()
    {
        Assert.False(context.Database.HasPendingModelChanges());
    }

    /// <summary>A new column means changing this test and docs/seguranca/dados-pessoais.md (minimization, D9).</summary>
    [Theory]
    [InlineData(typeof(GroupRow), "groups", "created_at,id,name")]
    [InlineData(typeof(MemberRow), "members", "group_id,id,joined_at,left_at,member_type,role,status,user_id")]
    [InlineData(typeof(InviteRow), "invites", "created_at,created_by_member_id,expires_at,group_id,id,revoked_at,token_hash,use_count")]
    [InlineData(typeof(GroupSettingsRow), "group_settings", "group_id,saved_template_id,schema_version,settings,template_key,updated_at,updated_by_member_id")]
    [InlineData(typeof(SavedTemplateRow), "saved_templates", "created_at,created_by_member_id,group_id,id,name,schema_version,settings")]
    [InlineData(typeof(MemberLevelRow), "member_levels", "group_id,level_tenths,member_id,set_at,set_by_member_id")]
    [InlineData(typeof(GuestRow), "guests", "created_at,group_id,member_id,name,primary_position,request_id")]
    [InlineData(typeof(ContentReportRow), "content_reports", "created_at,group_id,id,reason,reported_member_id,reporter_member_id")]
    public void Tables_KeepExactlyTheirColumns(Type row, string table, string columns)
    {
        var entity = Entity(row);

        Assert.Equal("groups", entity.GetSchema());
        Assert.Equal(table, entity.GetTableName());
        Assert.Equal(
            columns.Split(','),
            entity.GetProperties().Select(property => property.GetColumnName()).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Members_HaveOneIdPerPersonPerGroup_AndAnIndexForMyGroups()
    {
        var indexes = Entity(typeof(MemberRow)).GetIndexes().ToDictionary(index => index.GetDatabaseName()!);

        var unique = indexes[MemberConfiguration.GroupUserIndex];
        Assert.True(unique.IsUnique);
        Assert.Equal("user_id IS NOT NULL", unique.GetFilter());
        Assert.Equal(["group_id", "user_id"], unique.Properties.Select(property => property.GetColumnName()));
        Assert.Equal("status = 'active'", indexes[MemberConfiguration.ActiveUserIndex].GetFilter());
    }

    [Fact]
    public void Checks_PinTheEnumTextAndTheStatusRule()
    {
        var checks = Entity(typeof(MemberRow)).GetCheckConstraints().ToDictionary(check => check.Name!, check => check.Sql);

        Assert.Equal("role IN ('admin', 'co_admin', 'player', 'scorekeeper')", checks["ck_members_role"]);
        Assert.Equal("member_type IN ('drop_in', 'regular')", checks["ck_members_member_type"]);
        Assert.Equal("status IN ('active', 'left', 'removed')", checks["ck_members_status"]);
        Assert.Equal("(status = 'active') = (left_at IS NULL)", checks["ck_members_left_at"]);
    }

    [Fact]
    public void SettingsTables_CapTheDocumentAndPinTheTemplateKeys()
    {
        var settings = Entity(typeof(GroupSettingsRow)).GetCheckConstraints().ToDictionary(check => check.Name!, check => check.Sql);
        var templates = Entity(typeof(SavedTemplateRow)).GetCheckConstraints().ToDictionary(check => check.Name!, check => check.Sql);

        Assert.Equal("jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 8192", settings["ck_group_settings_document"]);
        Assert.Equal("jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 8192", templates["ck_saved_templates_document"]);
        Assert.Equal("schema_version = 1", settings["ck_group_settings_schema_version"]);
        Assert.Equal(
            "template_key IN ('pelada', 'racha-organizado', 'treino', 'areia-rei-da-quadra', 'do-zero')", settings["ck_group_settings_template_key"]);
        Assert.Equal("NOT (template_key IS NOT NULL AND saved_template_id IS NOT NULL)", settings["ck_group_settings_one_template"]);
        Assert.Equal("char_length(name) BETWEEN 1 AND 160", templates["ck_saved_templates_name_length"]);
    }

    [Fact]
    public void Invites_KeepOnlyAUniqueThirtyTwoByteHash()
    {
        var invites = Entity(typeof(InviteRow));

        var hashIndex = Assert.Single(invites.GetIndexes(), index => index.GetDatabaseName() == "ux_invites_token_hash");
        Assert.True(hashIndex.IsUnique);
        Assert.Contains(invites.GetCheckConstraints(), check => check.Sql == "octet_length(token_hash) = 32");
    }

    /// <summary>ADR 0051, D2: the scale in tenths, nullable for "Não sei", and an index to list one group's levels.</summary>
    [Fact]
    public void MemberLevels_PinTheScale_AndIndexTheGroup()
    {
        var levels = Entity(typeof(MemberLevelRow));
        var checks = levels.GetCheckConstraints().ToDictionary(check => check.Name!, check => check.Sql);

        Assert.Equal("level_tenths IS NULL OR (level_tenths BETWEEN 10 AND 50 AND level_tenths % 5 = 0)", checks["ck_member_levels_level"]);
        Assert.Equal(["member_id"], levels.FindPrimaryKey()!.Properties.Select(property => property.GetColumnName()));
        var byGroup = Assert.Single(levels.GetIndexes(), index => index.GetDatabaseName() == "ix_member_levels_group");
        Assert.Equal(["group_id"], byGroup.Properties.Select(property => property.GetColumnName()));
    }

    /// <summary>
    /// ADR 0053, D2 and D5: the name capped at 80 code points, the five positions, one guest per request id in a group,
    /// and a row that follows its member and its group, so deleting either never stops on this table.
    /// </summary>
    [Fact]
    public void Guests_PinTheNameAndPositions_AndOneRowPerRequest()
    {
        var guests = Entity(typeof(GuestRow));
        var checks = guests.GetCheckConstraints().ToDictionary(check => check.Name!, check => check.Sql);

        Assert.Equal("char_length(name) BETWEEN 1 AND 80", checks["ck_guests_name"]);
        Assert.Equal(
            "primary_position IS NULL OR primary_position IN ('libero', 'middleBlocker', 'opposite', 'outsideHitter', 'setter')",
            checks["ck_guests_primary_position"]);
        Assert.Equal(["member_id"], guests.FindPrimaryKey()!.Properties.Select(property => property.GetColumnName()));
        var byRequest = Assert.Single(guests.GetIndexes(), index => index.GetDatabaseName() == "ux_guests_group_request");
        Assert.True(byRequest.IsUnique);
        Assert.Equal(["group_id", "request_id"], byRequest.Properties.Select(property => property.GetColumnName()));
        Assert.All(guests.GetForeignKeys(), key => Assert.Equal(DeleteBehavior.Cascade, key.DeleteBehavior));
        Assert.Equal(2, guests.GetForeignKeys().Count());
    }

    /// <summary>
    /// E6.6, doors 1 and 2: the four reasons, one row per (group, reporter, target, reason) with the group's report (null
    /// target) counted once too, and a row that follows its group and its members.
    /// </summary>
    [Fact]
    public void ContentReports_PinTheReasons_AndOneRowPerReport()
    {
        var reports = Entity(typeof(ContentReportRow));
        var checks = reports.GetCheckConstraints().ToDictionary(check => check.Name!, check => check.Sql);

        Assert.Equal("reason IN ('hate_or_sexual', 'impersonation', 'offensive_name', 'spam')", checks["ck_content_reports_reason"]);
        var once = Assert.Single(reports.GetIndexes(), index => index.GetDatabaseName() == ContentReportConfiguration.OnceIndex);
        Assert.True(once.IsUnique);
        Assert.False(once.GetAreNullsDistinct());
        Assert.Equal(
            ["group_id", "reporter_member_id", "reported_member_id", "reason"],
            once.Properties.Select(property => property.GetColumnName()));
        Assert.All(reports.GetForeignKeys(), key => Assert.Equal(DeleteBehavior.Cascade, key.DeleteBehavior));
        Assert.Equal(3, reports.GetForeignKeys().Count());
        Assert.True(reports.FindProperty(nameof(ContentReportRow.ReportedMemberId))!.IsNullable);
    }

    public void Dispose() => context.Dispose();

    /// <summary>The design-time model keeps check constraints; the runtime one drops them.</summary>
    private IEntityType Entity(Type row) => context.GetService<IDesignTimeModel>().Model.FindEntityType(row)!;
}
