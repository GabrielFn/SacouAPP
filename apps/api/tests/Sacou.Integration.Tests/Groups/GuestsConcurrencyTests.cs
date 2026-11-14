using System.Net;
using Npgsql;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// C1 to C5 of E3.5 on a real Postgres: the guest's writes take the group lock and the round's take the round lock,
/// never one inside the other (ADR 0043, ADR 0053 D4). Each race runs a few times, so a lucky order does not pass it.
/// </summary>
public sealed class GuestsConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Repetitions = 3;

    private readonly ApiWithDatabase api = new(database);
    private readonly List<HttpClient> clients = [];

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync()
    {
        foreach (var client in clients)
        {
            client.Dispose();
        }

        await api.DisposeAsync();
    }

    /// <summary>C1: the last spot, the admin marking the guest and a drop-in answering together: one goes, one is first in line.</summary>
    [Fact]
    public async Task GuestAndDropInAtTheLastSpot_OneGoes_TheOtherIsFirstInLine()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var world = await WorldAsync();
            await RoundCalls.ConfigureAttendanceAsync(world, capacity: 1);
            var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
            var guest = await GuestCalls.CreateAsync(world);
            var dropIn = await world.AddPersonAsync();

            await RaceAsync(
                async () => Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, guest, going: true)),
                async () => Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, dropIn.Subject, round, going: true)).Status));

            var rows = await RoundCalls.RowsAsync(api.ConnectionString, round);
            Assert.Equal(["going", "waitlisted"], rows.Select(row => row.Status).Order(StringComparer.Ordinal));
            Assert.Equal(new[] { guest, dropIn.MemberId }.Order(), rows.Select(row => row.MemberId).Order());
        }
    }

    /// <summary>C2 and D11: 299 active members and two new guests together: one is created, the other is the member limit.</summary>
    [Fact]
    public async Task TwoGuestsForTheLastPlace_OneIsCreated_TheOtherIsTheLimit()
    {
        var world = await WorldAsync();
        await FillAsync(world, total: 299);

        var results = await RaceAsync(
            () => GuestCalls.AddAsync(world, "Primeiro"),
            () => GuestCalls.AddAsync(world, "Segundo"));

        Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Conflict], results.Select(result => result.StatusCode).Order());
        Assert.Equal(GuestCalls.MemberLimit, await SettingsCalls.CodeAsync(results.Single(result => result.StatusCode == HttpStatusCode.Conflict)));
        Assert.Equal(300, await CountActiveAsync(world.GroupId));
        foreach (var result in results)
        {
            result.Dispose();
        }
    }

    /// <summary>C3 and D5: a double tap with the same request id is one 201, one 200 and one guest.</summary>
    [Fact]
    public async Task DoubleTap_IsOneGuest()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var world = await WorldAsync();
            var requestId = Guid.NewGuid();

            var results = await RaceAsync(
                () => GuestCalls.AddAsync(world, "Léo", requestId),
                () => GuestCalls.AddAsync(world, "Léo", requestId));

            Assert.Equal([HttpStatusCode.OK, HttpStatusCode.Created], results.Select(result => result.StatusCode).Order());
            Assert.Equal(await GuestCalls.MemberIdAsync(results[0]), await GuestCalls.MemberIdAsync(results[1]));
            Assert.Equal(1, await GuestCalls.CountAsync(api.ConnectionString, world.GroupId));
            foreach (var result in results)
            {
                result.Dispose();
            }
        }
    }

    /// <summary>C4: removing and correcting the guest together ends removed and without a row, whatever the order.</summary>
    [Fact]
    public async Task RemovalAndCorrectionTogether_NeverBringTheRowBack()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var world = await WorldAsync();
            var guest = await GuestCalls.CreateAsync(world);

            var results = await RaceAsync(
                () => world.SendAsync(A.Admin, HttpMethod.Delete, world.MemberPath(guest)),
                () => world.SendAsync(A.CoAdmin, HttpMethod.Put, GuestCalls.GuestPath(world, guest), GuestCalls.CorrectBody("Corrigido", null)));

            Assert.Equal(HttpStatusCode.NoContent, results[0].StatusCode);
            Assert.Contains(results[1].StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.NotFound });
            Assert.Null(await GuestCalls.ReadAsync(api.ConnectionString, guest));
            Assert.Equal("removed", (await MemberRows.ReadAsync(api.ConnectionString, guest)).Status);
            foreach (var result in results)
            {
                result.Dispose();
            }
        }
    }

    /// <summary>C5: a guest going is removed from the group; the next write on the round lets it go and promotes the first in line.</summary>
    [Fact]
    public async Task RemovedGuestWhoWasGoing_GivesItsSpotToTheFirstInLine()
    {
        var world = await WorldAsync();
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 1);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        var guest = await GuestCalls.CreateAsync(world);
        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, guest, going: true));
        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, world.MemberIds[A.Player], going: true));
        using var removed = await world.SendAsync(A.Admin, HttpMethod.Delete, world.MemberPath(guest));
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);

        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, world.MemberIds[A.Scorekeeper], going: true));

        var rows = (await RoundCalls.RowsAsync(api.ConnectionString, round)).ToDictionary(row => row.MemberId, row => row.Status);
        Assert.Equal("not_going", rows[guest]);
        Assert.Equal("going", rows[world.MemberIds[A.Player]]);
        Assert.Equal("waitlisted", rows[world.MemberIds[A.Scorekeeper]]);
    }

    private async Task<GroupWorld> WorldAsync()
    {
        var client = api.CreateClient();
        clients.Add(client);
        return await GroupWorld.CreateAsync(api, client);
    }

    /// <summary>Active members written straight to the table until the group has <paramref name="total"/>.</summary>
    private async Task FillAsync(GroupWorld world, int total)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at, left_at)
            SELECT gen_random_uuid(), @group, NULL, 'player', 'drop_in', 'active', now(), NULL
            FROM generate_series(1, @missing - (SELECT count(*) FROM groups.members WHERE group_id = @group AND status = 'active'))
            """,
            connection);
        insert.Parameters.AddWithValue("group", world.GroupId);
        insert.Parameters.AddWithValue("missing", total);
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        Assert.Equal(total, await CountActiveAsync(world.GroupId));
    }

    private async Task<long> CountActiveAsync(Guid groupId)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var count = new NpgsqlCommand("SELECT count(*) FROM groups.members WHERE group_id = @group AND status = 'active'", connection);
        count.Parameters.AddWithValue("group", groupId);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private static async Task RaceAsync(params Func<Task>[] calls) =>
        await RaceAsync(calls.Select(call => (Func<Task<bool>>)(async () =>
        {
            await call();
            return true;
        })).ToArray());

    private static async Task<T[]> RaceAsync<T>(params Func<Task<T>>[] calls)
    {
        using var gate = new Barrier(calls.Length);
        return await Task.WhenAll(calls.Select(async call =>
        {
            await Task.Yield();
            gate.SignalAndWait(TestContext.Current.CancellationToken);
            return await call();
        }));
    }
}
