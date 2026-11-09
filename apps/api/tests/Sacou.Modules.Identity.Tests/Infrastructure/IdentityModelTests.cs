using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Infrastructure;

/// <summary>P2 and P3: the model matches the migration snapshot, and holds three columns, no more.</summary>
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
        var users = context.Model.FindEntityType(typeof(User))!;

        Assert.Equal("identity", users.GetSchema());
        Assert.Equal("users", users.GetTableName());
        Assert.Equal(
            ["created_at", "firebase_uid", "id"],
            users.GetProperties().Select(property => property.GetColumnName()).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void FirebaseUid_IsUniqueAndLengthChecked()
    {
        var users = context.Model.FindEntityType(typeof(User))!;

        var index = Assert.Single(users.GetIndexes());
        Assert.True(index.IsUnique);
        Assert.Equal("ux_users_firebase_uid", index.GetDatabaseName());
        Assert.Contains(users.GetCheckConstraints(), check => check.Sql == "char_length(firebase_uid) BETWEEN 1 AND 128");
    }

    public void Dispose() => context.Dispose();
}
