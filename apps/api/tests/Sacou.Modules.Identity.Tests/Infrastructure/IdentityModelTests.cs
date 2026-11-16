using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Infrastructure;

/// <summary>P2 and P3: the model matches the migration snapshot; users hold three columns and profiles six, no more.</summary>
public sealed class IdentityModelTests : IDisposable
{
    private readonly IdentityDbContext context = new IdentityDesignTimeFactory().CreateDbContext([]);

    [Fact]
    public void Model_HasNoChangesWithoutAMigration()
    {
        Assert.False(context.Database.HasPendingModelChanges());
    }

    /// <summary>Adding a column means changing this test and docs/seguranca/dados-pessoais.md.</summary>
    [Fact]
    public void Users_KeepOnlyIdFirebaseUidAndCreatedAt()
    {
        var users = Users();

        Assert.Equal("identity", users.GetSchema());
        Assert.Equal("users", users.GetTableName());
        Assert.Equal(
            ["created_at", "firebase_uid", "id"],
            users.GetProperties().Select(property => property.GetColumnName()).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void FirebaseUid_IsUniqueAndLengthChecked()
    {
        var users = Users();

        var index = Assert.Single(users.GetIndexes());
        Assert.True(index.IsUnique);
        Assert.Equal("ux_users_firebase_uid", index.GetDatabaseName());
        Assert.Contains(users.GetCheckConstraints(), check => check.Sql == "char_length(firebase_uid) BETWEEN 1 AND 128");
    }

    /// <summary>E3.17 (ADR 0051, D1): a new column means changing this test and docs/seguranca/dados-pessoais.md.</summary>
    [Fact]
    public void PlayerProfiles_KeepExactlyTheirSixColumns()
    {
        var profiles = Entity(typeof(PlayerProfileRow));

        Assert.Equal("identity", profiles.GetSchema());
        Assert.Equal("player_profiles", profiles.GetTableName());
        Assert.Equal(
            ["nickname", "other_positions", "primary_position", "suggested_level_tenths", "updated_at", "user_id"],
            profiles.GetProperties().Select(property => property.GetColumnName()).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void PlayerProfiles_CheckTheNicknameThePositionsAndTheScale()
    {
        var checks = Entity(typeof(PlayerProfileRow)).GetCheckConstraints().ToDictionary(check => check.Name!, check => check.Sql);

        Assert.Equal("char_length(nickname) BETWEEN 1 AND 80", checks["ck_player_profiles_nickname_length"]);
        Assert.Equal(
            "primary_position IS NULL OR primary_position IN ('any', 'libero', 'middle_blocker', 'opposite', 'outside_hitter', 'setter')",
            checks["ck_player_profiles_primary_position"]);
        Assert.Equal(
            "other_positions <@ ARRAY['libero', 'middle_blocker', 'opposite', 'outside_hitter', 'setter']::text[]",
            checks["ck_player_profiles_other_positions"]);
        Assert.Equal("cardinality(other_positions) <= 4", checks["ck_player_profiles_other_positions_count"]);
        Assert.Equal(
            "suggested_level_tenths IS NULL OR (suggested_level_tenths BETWEEN 10 AND 50 AND suggested_level_tenths % 5 = 0)",
            checks["ck_player_profiles_suggested_level"]);
        Assert.Equal(5, checks.Count);
    }

    /// <summary>Deleting the user deletes the profile (E3.16): the only foreign key, inside the module.</summary>
    [Fact]
    public void PlayerProfiles_CascadeFromTheUser()
    {
        var key = Assert.Single(Entity(typeof(PlayerProfileRow)).GetForeignKeys());

        Assert.Equal("fk_player_profiles_users", key.GetConstraintName());
        Assert.Equal(DeleteBehavior.Cascade, key.DeleteBehavior);
        Assert.Equal(typeof(User), key.PrincipalEntityType.ClrType);
    }

    /// <summary>U5 of E3.16 (ADR 0056, D5): the tombstone keeps the hash of the login and the date, and nothing else.</summary>
    [Fact]
    public void DeletedAccounts_KeepOnlyTheHashAndTheDate()
    {
        var deleted = Entity(typeof(DeletedAccountRow));

        Assert.Equal("identity", deleted.GetSchema());
        Assert.Equal("deleted_accounts", deleted.GetTableName());
        Assert.Equal(
            ["deleted_at", "subject_hash"],
            deleted.GetProperties().Select(property => property.GetColumnName()).Order(StringComparer.Ordinal));
        Assert.Equal("bytea", deleted.FindProperty(nameof(DeletedAccountRow.SubjectHash))!.GetColumnType());
        Assert.Equal("pk_deleted_accounts", deleted.FindPrimaryKey()!.GetName());
        Assert.Equal("octet_length(subject_hash) = 32", Assert.Single(deleted.GetCheckConstraints()).Sql);
        Assert.Empty(deleted.GetForeignKeys());
    }

    public void Dispose() => context.Dispose();

    /// <summary>The design-time model keeps check constraints; the runtime one drops them.</summary>
    private IEntityType Users() => Entity(typeof(User));

    private IEntityType Entity(Type type) => context.GetService<IDesignTimeModel>().Model.FindEntityType(type)!;
}
