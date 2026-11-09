using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// Reads trust the stored name, and the rename checks the role in its own UPDATE (ADR 0040, D8), on the
/// real API and a real Postgres.
/// </summary>
public sealed class GroupsStoredNameAndRenameRaceTests(IntegrationDatabase database) : IAsyncLifetime
{
    /// <summary>Hangul filler between letters: the rule refuses it today, an older one might have let it in.</summary>
    private static readonly string RefusedToday = "Ra" + char.ConvertFromUtf32(0x3164) + "cha";

    private static readonly TimeSpan LockWaitTimeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(20);

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task StoredNameTheRuleNowRefuses_IsStillListedAndShown()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await using (var connection = await OpenAsync())
        {
            await using var update = new NpgsqlCommand("UPDATE groups.groups SET name = @name WHERE id = @group", connection);
            update.Parameters.AddWithValue("name", RefusedToday);
            update.Parameters.AddWithValue("group", world.GroupId);
            await update.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        using var list = await world.SendAsync(GroupActor.Admin, HttpMethod.Get, GroupWorld.GroupsPath);
        using var detail = await world.SendAsync(GroupActor.Admin, HttpMethod.Get, world.GroupPath);
        var groups = JsonNode.Parse(await list.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsArray();

        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        Assert.Contains(groups, group => group!["name"]!.GetValue<string>() == RefusedToday);
    }

    /// <summary>
    /// The demotion commits after the filter has read the co-admin's role but before the UPDATE takes its
    /// snapshot: a table lock holds the UPDATE while the test demotes. The rename is refused with 403.
    /// </summary>
    [Fact]
    public async Task DemotionThatLandsAfterTheFilter_StopsTheRename()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await using var connection = await OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await ExecuteAsync(connection, "LOCK TABLE groups.groups IN SHARE MODE", world);

        var rename = world.SendAsync(GroupActor.CoAdmin, HttpMethod.Patch, world.GroupPath, """{"name":"Depois"}""");
        await WaitForTheBlockedRenameAsync();
        await ExecuteAsync(connection, "UPDATE groups.members SET role = 'player' WHERE group_id = @group AND user_id = @user", world);
        await transaction.CommitAsync(TestContext.Current.CancellationToken);
        using var response = await rename;

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("Racha da matriz", await StoredNameAsync(world));
    }

    private async Task WaitForTheBlockedRenameAsync()
    {
        using var deadline = new CancellationTokenSource(LockWaitTimeout);
        await using var connection = await OpenAsync();
        await using var waiting = new NpgsqlCommand(
            """
            SELECT count(*) FROM pg_locks
            WHERE relation = 'groups.groups'::regclass AND NOT granted AND pid <> pg_backend_pid()
            """,
            connection);
        while ((long)(await waiting.ExecuteScalarAsync(deadline.Token))! == 0)
        {
            await Task.Delay(PollInterval, deadline.Token);
        }
    }

    private async Task<string> StoredNameAsync(GroupWorld world)
    {
        await using var connection = await OpenAsync();
        await using var select = new NpgsqlCommand("SELECT name FROM groups.groups WHERE id = @group", connection);
        select.Parameters.AddWithValue("group", world.GroupId);
        return (string)(await select.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql, GroupWorld world)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("group", world.GroupId);
        command.Parameters.AddWithValue("user", world.Users[GroupActor.CoAdmin]);
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }
}
