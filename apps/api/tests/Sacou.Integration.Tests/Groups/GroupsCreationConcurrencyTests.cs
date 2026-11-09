using System.Net;
using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// The per-person ceiling under a race (advisory lock, ADR 0040, D6), and the role read from the database on
/// every request (D3), on the real API and a real Postgres.
/// </summary>
public sealed class GroupsCreationConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int MembershipCeiling = 100;
    private const int SimultaneousCreations = 8;
    private const int Rounds = 3;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>With 99 groups, eight simultaneous creations yield exactly one 201 and seven 409, never 101 groups.</summary>
    [Fact]
    public async Task SimultaneousCreations_NeverPassTheCeiling()
    {
        using var client = api.CreateClient();
        for (var round = 0; round < Rounds; round++)
        {
            var world = await GroupWorld.CreateAsync(api, client);
            var user = world.Users[GroupActor.NonMember];
            for (var index = 0; index < MembershipCeiling - 1; index++)
            {
                await InsertGroupWithMemberAsync(user);
            }

            using var gate = new Barrier(SimultaneousCreations);
            var calls = Enumerable.Range(0, SimultaneousCreations).Select(async index =>
            {
                await Task.Yield();
                gate.SignalAndWait(TestContext.Current.CancellationToken);
                using var response = await world.SendAsync(GroupActor.NonMember, HttpMethod.Post, GroupWorld.GroupsPath, $$"""{"name":"Corrida {{index}}"}""");
                return response.StatusCode;
            });
            var statuses = await Task.WhenAll(calls);

            Assert.Equal(1, statuses.Count(status => status == HttpStatusCode.Created));
            Assert.Equal(SimultaneousCreations - 1, statuses.Count(status => status == HttpStatusCode.Conflict));
            Assert.Equal(MembershipCeiling, await ScalarAsync("SELECT count(*) FROM groups.members WHERE user_id = @user AND status = 'active'", user));
        }
    }

    /// <summary>The role is never cached: a demotion, a removal and a departure take effect on the next request.</summary>
    [Fact]
    public async Task RoleChangesInTheDatabase_TakeEffectOnTheNextRequest()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var user = world.Users[GroupActor.CoAdmin];

        using var allowed = await world.SendAsync(GroupActor.CoAdmin, HttpMethod.Patch, world.GroupPath, """{"name":"Antes"}""");
        await ExecuteAsync("UPDATE groups.members SET role = 'player' WHERE group_id = @group AND user_id = @user", world.GroupId, user);
        using var demoted = await world.SendAsync(GroupActor.CoAdmin, HttpMethod.Patch, world.GroupPath, """{"name":"Depois"}""");
        await ExecuteAsync("UPDATE groups.members SET status = 'removed', left_at = now() WHERE group_id = @group AND user_id = @user", world.GroupId, user);
        using var removed = await world.SendAsync(GroupActor.CoAdmin, HttpMethod.Get, world.GroupPath);
        await ExecuteAsync("UPDATE groups.members SET status = 'active', left_at = NULL, role = 'co_admin' WHERE group_id = @group AND user_id = @user", world.GroupId, user);
        using var back = await world.SendAsync(GroupActor.CoAdmin, HttpMethod.Get, world.GroupPath);

        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, demoted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, removed.StatusCode);
        Assert.Equal(HttpStatusCode.OK, back.StatusCode);
    }

    private async Task InsertGroupWithMemberAsync(Guid user)
    {
        var group = Guid.CreateVersion7();
        await ExecuteAsync("INSERT INTO groups.groups (id, name, created_at) VALUES (@group, 'Racha', now())", group, user);
        await ExecuteAsync(
            "INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at) VALUES (gen_random_uuid(), @group, @user, 'player', 'drop_in', 'active', now())",
            group, user);
    }

    private async Task<long> ScalarAsync(string sql, Guid user)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("user", user);
        return (long)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private async Task ExecuteAsync(string sql, Guid group, Guid user)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("group", group);
        command.Parameters.AddWithValue("user", user);
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }
}
