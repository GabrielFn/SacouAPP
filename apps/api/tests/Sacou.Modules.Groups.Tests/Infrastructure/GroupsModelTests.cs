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
    public void Invites_KeepOnlyAUniqueThirtyTwoByteHash()
    {
        var invites = Entity(typeof(InviteRow));

        var hashIndex = Assert.Single(invites.GetIndexes(), index => index.GetDatabaseName() == "ux_invites_token_hash");
        Assert.True(hashIndex.IsUnique);
        Assert.Contains(invites.GetCheckConstraints(), check => check.Sql == "octet_length(token_hash) = 32");
    }

    public void Dispose() => context.Dispose();

    /// <summary>The design-time model keeps check constraints; the runtime one drops them.</summary>
    private IEntityType Entity(Type row) => context.GetService<IDesignTimeModel>().Model.FindEntityType(row)!;
}
