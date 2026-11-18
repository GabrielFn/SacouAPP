using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Sacou.Modules.Matches.Infrastructure;
using Xunit;

namespace Sacou.Modules.Matches.Tests.Infrastructure;

/// <summary>The model matches the migration snapshot, and each table holds exactly its columns (ADR 0060, D13).</summary>
public sealed class MatchesModelTests : IDisposable
{
    private const string Schema = "matches";

    private readonly MatchesDbContext context = new MatchesDesignTimeFactory().CreateDbContext([]);

    [Fact]
    public void Model_HasNoChangesWithoutAMigration()
    {
        Assert.False(context.Database.HasPendingModelChanges());
    }

    /// <summary>
    /// A new column means changing this test and docs/seguranca/dados-pessoais.md. None of them is a name, an e-mail
    /// or a user id: a person here is a member id, and a phone is a random installation id.
    /// </summary>
    [Theory]
    [InlineData(typeof(CourtSessionRow), "court_sessions",
        "created_at,current_batch,envelope_bytes,event_count,group_id,id,last_event_at,open_match_id,points_a,points_b,round_id,set_number,sets_a,sets_b")]
    [InlineData(typeof(CourtWriterRow), "court_writers", "batch,court_session_id,device_id,events_before,member_id,started_at")]
    [InlineData(typeof(CourtEventRow), "court_events",
        "batch,court_session_id,device_id,envelope,event_id,match_id,position,received_at,schema_version,sequence,type")]
    public void Tables_KeepExactlyTheirColumns(Type row, string table, string columns)
    {
        var entity = Entity(row);

        Assert.Equal(Schema, entity.GetSchema());
        Assert.Equal(table, entity.GetTableName());
        Assert.Equal(
            columns.Split(','),
            entity.GetProperties().Select(property => property.GetColumnName()).Order(StringComparer.Ordinal));
        Assert.DoesNotContain(entity.GetProperties(), property => property.GetColumnName() is "user_id" or "email" or "name" or "nickname");
    }

    [Fact]
    public void EveryTableAndEveryForeignKey_StayInTheMatchesSchema()
    {
        var entities = context.GetService<IDesignTimeModel>().Model.GetEntityTypes().ToList();

        Assert.Equal(3, entities.Count);
        Assert.All(entities, entity => Assert.Equal(Schema, entity.GetSchema()));
        Assert.All(entities.SelectMany(entity => entity.GetForeignKeys()), key => Assert.Equal(Schema, key.PrincipalEntityType.GetSchema()));
    }

    [Fact]
    public void TheEnvelope_IsText_NeverJsonb()
    {
        var envelope = Entity(typeof(CourtEventRow)).GetProperties().Single(property => property.GetColumnName() == "envelope");

        Assert.Equal("text", envelope.GetColumnType());
    }

    [Fact]
    public void OneCourtPerRound_AndOneRowPerEventId()
    {
        Assert.Contains(Entity(typeof(CourtSessionRow)).GetIndexes(), index => index.IsUnique && index.Properties.Single().Name == nameof(CourtSessionRow.RoundId));
        Assert.Contains(Entity(typeof(CourtEventRow)).GetIndexes(), index => index.IsUnique
            && index.Properties.Select(property => property.Name).SequenceEqual([nameof(CourtEventRow.CourtSessionId), nameof(CourtEventRow.EventId)]));
    }

    public void Dispose() => context.Dispose();

    /// <summary>The design-time model keeps check constraints; the runtime one drops them.</summary>
    private IEntityType Entity(Type row) => context.GetService<IDesignTimeModel>().Model.FindEntityType(row)!;
}
