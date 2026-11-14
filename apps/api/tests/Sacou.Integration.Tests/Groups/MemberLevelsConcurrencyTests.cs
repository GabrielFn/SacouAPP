using System.Net;
using Npgsql;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// C1 to C4 of E3.17 (ADR 0051, D10): a level write is judged under the group lock, so a demotion or a removal that
/// lands after the access filter wins, and concurrent writes leave one row per member and no 500.
/// </summary>
public sealed class MemberLevelsConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int ConcurrentWrites = 10;
    private const int Rounds = 5;
    private const int BatchSize = 5;

    private static readonly string[] Levels = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "null"];

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>C1: the co-admin is demoted while the request waits for the lock. 403, and no row.</summary>
    [Fact]
    public async Task DemotionThatLandsAfterTheFilter_StopsTheWrite()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var target = world.MemberIds[A.Player];

        using var response = await WhileHoldingTheLockAsync(
            world,
            () => LevelCalls.SetAsync(world, A.CoAdmin, target, "4"),
            "UPDATE groups.members SET role = 'player' WHERE id = @member",
            world.MemberIds[A.CoAdmin]);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("groups.forbidden", await SettingsCalls.CodeAsync(response));
        Assert.Null(await LevelCalls.ReadAsync(api.ConnectionString, target));
    }

    /// <summary>C2: the target is removed while the request waits for the lock. 404, and no row.</summary>
    [Fact]
    public async Task RemovalThatLandsAfterTheFilter_IsNotFound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var target = world.MemberIds[A.Player];

        using var response = await WhileHoldingTheLockAsync(
            world,
            () => LevelCalls.SetAsync(world, A.Admin, target, "4"),
            "UPDATE groups.members SET status = 'removed', left_at = now() WHERE id = @member",
            target);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(LevelCalls.MemberNotFound, await SettingsCalls.CodeAsync(response));
        Assert.Null(await LevelCalls.ReadAsync(api.ConnectionString, target));
    }

    /// <summary>C3: ten writes at once on the same member, five times. All 200, one row, one of the values sent.</summary>
    [Fact]
    public async Task ConcurrentWritesOnOneMember_LeaveOneRowWithOneOfTheValues()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var target = world.MemberIds[A.Player];
        short?[] sent = [.. Levels.Select(level => level == "null" ? (short?)null : (short)(decimal.Parse(level, System.Globalization.CultureInfo.InvariantCulture) * 10))];

        for (var round = 0; round < Rounds; round++)
        {
            var writes = Levels.Take(ConcurrentWrites)
                .Select((level, index) => LevelCalls.SetAsync(world, index % 2 == 0 ? A.Admin : A.CoAdmin, target, level));
            var responses = await Task.WhenAll(writes);

            Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
            Assert.Equal(1, await LevelCalls.CountAsync(api.ConnectionString, world.GroupId));
            Assert.Contains((await LevelCalls.ReadAsync(api.ConnectionString, target))!.Tenths, sent);
            Array.ForEach(responses, response => response.Dispose());
        }
    }

    /// <summary>C4: a batch of five and a single write on one of the five at once. One row per member, no 500.</summary>
    [Fact]
    public async Task BatchAndSingleAtOnce_LeaveOneRowPerMember()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var targets = new List<Guid>();
        for (var index = 0; index < BatchSize; index++)
        {
            targets.Add(await world.AddMemberAsync("player"));
        }

        var batch = world.SendAsync(A.Admin, HttpMethod.Put, LevelCalls.ListPath(world), LevelCalls.Batch([.. targets.Select(target => (target, "3"))]));
        var single = LevelCalls.SetAsync(world, A.CoAdmin, targets[0], "5");
        using var batchResponse = await batch;
        using var singleResponse = await single;

        Assert.Equal(HttpStatusCode.OK, batchResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, singleResponse.StatusCode);
        Assert.Equal(BatchSize, await LevelCalls.CountAsync(api.ConnectionString, world.GroupId));
        Assert.Contains((await LevelCalls.ReadAsync(api.ConnectionString, targets[0]))!.Tenths, new short?[] { 30, 50 });
    }

    /// <summary>Holds the group row, starts the request, waits until it is queued behind the lock, runs the change and lets go.</summary>
    private async Task<HttpResponseMessage> WhileHoldingTheLockAsync(GroupWorld world, Func<Task<HttpResponseMessage>> request, string change, Guid member)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var transaction = await connection.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await GroupLock.HoldAsync(connection, world.GroupId);

        var pending = request();
        await GroupLock.WaitUntilBlockedAsync(api.ConnectionString, connection.ProcessID);
        await using (var update = new NpgsqlCommand(change, connection))
        {
            update.Parameters.AddWithValue("member", member);
            await update.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        await transaction.CommitAsync(TestContext.Current.CancellationToken);
        return await pending;
    }
}
