using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Sacou.Modules.Notifications.Infrastructure;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>The model matches the migration snapshot, each table holds exactly its columns, and nothing leaves the schema.</summary>
public sealed class NotificationsModelTests : IDisposable
{
    private const string Schema = "notifications";

    private readonly NotificationsDbContext context = new NotificationsDesignTimeFactory().CreateDbContext([]);

    [Fact]
    public void Model_HasNoChangesWithoutAMigration() => Assert.False(context.Database.HasPendingModelChanges());

    /// <summary>
    /// A new column means changing this test and docs/seguranca/dados-pessoais.md. Only <c>push_devices</c> has a user id
    /// and a token; a notification points to a member (ADR 0012).
    /// </summary>
    [Theory]
    [InlineData(typeof(NotificationRow), "notifications", "created_at,dedupe_key,expires_at,group_id,id,kind,member_id,read_at,round_id")]
    [InlineData(typeof(PushDeviceRow), "push_devices", "created_at,disabled_at,disabled_reason,expo_token,id,installation_id,last_seen_at,platform,user_id")]
    [InlineData(typeof(PushDeliveryRow), "push_deliveries", "attempts,created_at,device_id,error_code,id,lease_until,next_attempt_at,notification_id,state,ticket_id,updated_at")]
    public void Tables_KeepExactlyTheirColumns(Type row, string table, string columns)
    {
        var entity = context.GetService<IDesignTimeModel>().Model.FindEntityType(row)!;

        Assert.Equal(Schema, entity.GetSchema());
        Assert.Equal(table, entity.GetTableName());
        Assert.Equal(columns.Split(','), entity.GetProperties().Select(property => property.GetColumnName()).Order(StringComparer.Ordinal));
    }

    [Fact]
    public void EveryTableAndEveryForeignKey_StayInTheNotificationsSchema()
    {
        var entities = context.GetService<IDesignTimeModel>().Model.GetEntityTypes().ToList();

        Assert.Equal(3, entities.Count);
        Assert.All(entities, entity => Assert.Equal(Schema, entity.GetSchema()));
        Assert.All(entities.SelectMany(entity => entity.GetForeignKeys()), key => Assert.Equal(Schema, key.PrincipalEntityType.GetSchema()));
    }

    [Fact]
    public void Notifications_HaveNoUserIdNorText()
    {
        var entity = context.GetService<IDesignTimeModel>().Model.FindEntityType(typeof(NotificationRow))!;

        Assert.DoesNotContain(entity.GetProperties(), property => property.GetColumnName() is "user_id" or "title" or "body" or "venue" or "name");
    }

    public void Dispose() => context.Dispose();
}
