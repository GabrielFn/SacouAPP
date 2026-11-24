using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Modules.Sessions.Infrastructure.Outbox;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>P2 and P3: the model matches the migration snapshot, and each table holds exactly its columns.</summary>
public sealed class SessionsModelTests : IDisposable
{
    private const string Schema = "sessions";

    private readonly SessionsDbContext context = new SessionsDesignTimeFactory().CreateDbContext([]);

    [Fact]
    public void Model_HasNoChangesWithoutAMigration()
    {
        Assert.False(context.Database.HasPendingModelChanges());
    }

    /// <summary>
    /// A new column means changing this test and docs/seguranca/dados-pessoais.md (minimization, ADR 0043 D9). None of
    /// them is a name, an e-mail or a user id: a person here is a member id.
    /// </summary>
    [Theory]
    [InlineData(typeof(SeriesRow), "round_series", "created_at,group_id,id,local_time,stopped_at,time_zone,venue,weekday")]
    [InlineData(typeof(RoundRow), "rounds", "closed_at,created_at,group_id,id,link_code,local_date,local_time,next_sequence,series_id,settings_layer,starts_at,status,teams_confirmed_at,time_zone,venue")]
    [InlineData(typeof(AttendanceRow), "attendances", "channel,member_id,promoted_at,responded_at,round_id,sequence,source,status")]
    [InlineData(typeof(RoundTeamSlotRow), "round_teams", "member_id,position,round_id,team_number")]
    [InlineData(typeof(OutboxMessageRow), "outbox_messages", "attempts,dedupe_key,id,occurred_at,payload,processed_at,set_aside_at,type")]
    public void Tables_KeepExactlyTheirColumns(Type row, string table, string columns)
    {
        var entity = Entity(row);

        Assert.Equal(Schema, entity.GetSchema());
        Assert.Equal(table, entity.GetTableName());
        Assert.Equal(
            columns.Split(','),
            entity.GetProperties().Select(property => property.GetColumnName()).Order(StringComparer.Ordinal));
        Assert.DoesNotContain(entity.GetProperties(), property => property.GetColumnName() is "user_id" or "email" or "name");
    }

    /// <summary>The model half of A2: every table is in the <c>sessions</c> schema and every key points inside it.</summary>
    [Fact]
    public void EveryTableAndEveryForeignKey_StayInTheSessionsSchema()
    {
        var entities = context.GetService<IDesignTimeModel>().Model.GetEntityTypes().ToList();

        Assert.Equal(5, entities.Count);
        Assert.All(entities, entity => Assert.Equal(Schema, entity.GetSchema()));
        Assert.All(entities.SelectMany(entity => entity.GetForeignKeys()), key => Assert.Equal(Schema, key.PrincipalEntityType.GetSchema()));
    }

    public void Dispose() => context.Dispose();

    /// <summary>The design-time model keeps check constraints; the runtime one drops them.</summary>
    private IEntityType Entity(Type row) => context.GetService<IDesignTimeModel>().Model.FindEntityType(row)!;
}
