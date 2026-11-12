using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Npgsql;
using Sacou.Modules.Groups;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// E2.12 (ADR 0050): a settings document saved before the queue modes gets the four new leaves with the defaults
/// of the catalog, and a leaf it already has stays. Runs the SQL of the migration itself on rows of the old shape.
/// </summary>
public sealed class GroupSettingsMigrationTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string MigrationType = "Sacou.Modules.Groups.Infrastructure.Migrations.AddQueueExitModeSettings";
    private const string Provider = "Npgsql.EntityFrameworkCore.PostgreSQL";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task OldDocuments_GetTheQueueModeDefaults_AndKeepTheirOwnLeaves()
    {
        var (group, member) = await InsertGroupWithMemberAsync();
        var template = Guid.CreateVersion7();
        await ExecuteAsync(
            """
            INSERT INTO groups.group_settings (group_id, schema_version, settings, updated_at, updated_by_member_id)
            VALUES (@group, 1, '{"schemaVersion": 1, "queue": {"enabled": true, "exitCriterion": "draw"}}', now(), @member);
            INSERT INTO groups.saved_templates (id, group_id, name, schema_version, settings, created_at, created_by_member_id)
            VALUES (@template, @group, 'Modelo', 1, '{"schemaVersion": 1, "queue": {"enabled": false, "exitCriterion": "manual", "exitMode": "fixed-count"}}', now(), @member)
            """,
            ("group", group), ("member", member), ("template", template));

        foreach (var sql in UpSql())
        {
            await ExecuteAsync(sql);
        }

        Assert.Equal(
            """{"enabled":true,"exitMode":"automatic","exitCriterion":"draw","fixedExitCount":2,"winnerExitWins":3,"winnerExitEnabled":false}""",
            await ReadQueueAsync("SELECT settings -> 'queue' FROM groups.group_settings WHERE group_id = @id", group));
        Assert.Equal(
            """{"enabled":false,"exitMode":"fixed-count","exitCriterion":"manual","fixedExitCount":2,"winnerExitWins":3,"winnerExitEnabled":false}""",
            await ReadQueueAsync("SELECT settings -> 'queue' FROM groups.saved_templates WHERE id = @id", template));
    }

    private static IEnumerable<string> UpSql()
    {
        var type = typeof(GroupsModule).Assembly.GetType(MigrationType, throwOnError: true)!;
        var migration = (Migration)Activator.CreateInstance(type, nonPublic: true)!;
        migration.ActiveProvider = Provider;
        return migration.UpOperations.OfType<SqlOperation>().Select(operation => operation.Sql);
    }

    private async Task<string> ReadQueueAsync(string sql, Guid id)
    {
        await using var connection = await OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("id", id);
        var json = (string)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
        return JsonNode.Parse(json)!.ToJsonString();
    }

    private async Task<(Guid Group, Guid Member)> InsertGroupWithMemberAsync()
    {
        var group = Guid.CreateVersion7();
        var member = Guid.CreateVersion7();
        await ExecuteAsync(
            """
            INSERT INTO groups.groups (id, name, created_at) VALUES (@group, 'Racha', now());
            INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at)
            VALUES (@member, @group, @user, 'admin', 'regular', 'active', now())
            """,
            ("group", group), ("member", member), ("user", Guid.NewGuid()));
        return (group, member);
    }

    private async Task ExecuteAsync(string sql, params (string Name, Guid Value)[] parameters)
    {
        await using var connection = await OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }

        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }
}
