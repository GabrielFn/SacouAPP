using System.Net;
using Npgsql;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;
using R = Sacou.Integration.Tests.Groups.GuestRoute;

namespace Sacou.Integration.Tests.Groups;

/// <summary>The two guest routes of E3.5, and the member list that shows the guest.</summary>
public enum GuestRoute
{
    AddGuest,
    CorrectGuest,
    ListMembers,
}

/// <summary>
/// E3.5 on the real API and a real Postgres: who may add, correct and see a guest (ADR 0053, D7). The matrix is
/// written by hand from the plan, never derived from the production table.
/// </summary>
public sealed class GuestsAuthorizationTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string NotRegistered = "identity.user-not-registered";
    private const string NotFound = "groups.group-not-found";
    private const string Forbidden = "groups.forbidden";
    private const string GuestName = "Convidado Teste";

    private readonly ApiWithDatabase api = new(database);

    public static TheoryData<A, R, int, string?> Matrix { get; } = new()
    {
        { A.Admin, R.AddGuest, 201, null },
        { A.Admin, R.CorrectGuest, 200, null },
        { A.Admin, R.ListMembers, 200, null },
        { A.CoAdmin, R.AddGuest, 201, null },
        { A.CoAdmin, R.CorrectGuest, 200, null },
        { A.CoAdmin, R.ListMembers, 200, null },
        { A.Scorekeeper, R.AddGuest, 403, Forbidden },
        { A.Scorekeeper, R.CorrectGuest, 403, Forbidden },
        { A.Scorekeeper, R.ListMembers, 200, null },
        { A.Player, R.AddGuest, 403, Forbidden },
        { A.Player, R.CorrectGuest, 403, Forbidden },
        { A.Player, R.ListMembers, 200, null },
        { A.LeftMember, R.AddGuest, 404, NotFound },
        { A.LeftMember, R.CorrectGuest, 404, NotFound },
        { A.LeftMember, R.ListMembers, 404, NotFound },
        { A.RemovedMember, R.AddGuest, 404, NotFound },
        { A.RemovedMember, R.CorrectGuest, 404, NotFound },
        { A.RemovedMember, R.ListMembers, 404, NotFound },
        { A.OutsiderMember, R.AddGuest, 404, NotFound },
        { A.OutsiderMember, R.CorrectGuest, 404, NotFound },
        { A.OutsiderMember, R.ListMembers, 404, NotFound },
        { A.NonMember, R.AddGuest, 404, NotFound },
        { A.NonMember, R.CorrectGuest, 404, NotFound },
        { A.NonMember, R.ListMembers, 404, NotFound },
        { A.Unregistered, R.AddGuest, 403, NotRegistered },
        { A.Unregistered, R.CorrectGuest, 403, NotRegistered },
        { A.Unregistered, R.ListMembers, 403, NotRegistered },
        { A.Anonymous, R.AddGuest, 401, null },
        { A.Anonymous, R.CorrectGuest, 401, null },
        { A.Anonymous, R.ListMembers, 401, null },
    };

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>A refused write leaves the guests as they were: one guest, with its first name.</summary>
    [Theory]
    [MemberData(nameof(Matrix))]
    public async Task Matrix_EveryActorOnEveryGuestRoute(A actor, GuestRoute route, int status, string? code)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var guest = await GuestCalls.CreateAsync(world, GuestName);
        var (method, path, json) = route switch
        {
            R.AddGuest => (HttpMethod.Post, GuestCalls.GuestsPath(world), GuestCalls.AddBody(Guid.NewGuid(), "Outro")),
            R.CorrectGuest => (HttpMethod.Put, GuestCalls.GuestPath(world, guest), GuestCalls.CorrectBody("Corrigido", "libero")),
            R.ListMembers => (HttpMethod.Get, world.GroupPath + "/members", null),
            _ => throw new ArgumentOutOfRangeException(nameof(route), route, "Every route needs a request."),
        };

        using var response = await world.SendAsync(actor, method, path, json);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal((HttpStatusCode)status, response.StatusCode);
        Assert.Equal(code, await SettingsCalls.CodeAsync(response));
        Assert.Equal(route == R.ListMembers && status == 200, text.Contains(GuestName, StringComparison.Ordinal));
        if (route != R.ListMembers && status >= 400)
        {
            Assert.Equal(1, await GuestCalls.CountAsync(api.ConnectionString, world.GroupId));
            Assert.Equal(GuestName, (await GuestCalls.ReadAsync(api.ConnectionString, guest))!.Name);
        }
    }

    [Fact]
    public void Matrix_HasOneRowPerActorAndRoute()
    {
        var pairs = Matrix.Select(row => (row.Data.Item1, row.Data.Item2)).ToHashSet();

        Assert.Equal(Enum.GetValues<A>().Length * Enum.GetValues<R>().Length, pairs.Count);
        Assert.Equal(Matrix.Count, pairs.Count);
    }

    /// <summary>IDOR: the admin of A corrects a guest of B. 404 <c>member-not-found</c>, and B's guest keeps its name.</summary>
    [Fact]
    public async Task GuestOfAnotherGroup_IsNotFound_AndKeepsItsName()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var foreignCreated = await world.SendAsync(
            A.OutsiderMember, HttpMethod.Post, $"{GroupWorld.GroupsPath}/{world.OtherGroupId}/guests", GuestCalls.AddBody(Guid.NewGuid(), "Do outro"));
        Assert.Equal(HttpStatusCode.Created, foreignCreated.StatusCode);
        var foreign = await GuestCalls.MemberIdAsync(foreignCreated);

        using var response = await world.SendAsync(A.Admin, HttpMethod.Put, GuestCalls.GuestPath(world, foreign), GuestCalls.CorrectBody("Roubado", null));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(LevelCalls.MemberNotFound, await SettingsCalls.CodeAsync(response));
        Assert.Equal(new GuestState(world.OtherGroupId, "Do outro", null), await GuestCalls.ReadAsync(api.ConnectionString, foreign));
    }

    /// <summary>
    /// The co-admin is demoted after the filter read the role but before the write takes the group lock: the request
    /// is judged under the lock, gets 403 and creates nothing.
    /// </summary>
    [Fact]
    public async Task DemotionThatLandsAfterTheFilter_StopsTheGuest()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var transaction = await connection.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await GroupLock.HoldAsync(connection, world.GroupId);

        var add = GuestCalls.AddAsync(world, "Tardio", actor: A.CoAdmin);
        await GroupLock.WaitUntilBlockedAsync(api.ConnectionString, connection.ProcessID);
        await using (var demote = new NpgsqlCommand("UPDATE groups.members SET role = 'player' WHERE id = @id", connection))
        {
            demote.Parameters.AddWithValue("id", world.MemberIds[A.CoAdmin]);
            await demote.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        await transaction.CommitAsync(TestContext.Current.CancellationToken);
        using var response = await add;

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(Forbidden, await SettingsCalls.CodeAsync(response));
        Assert.Equal(0, await GuestCalls.CountAsync(api.ConnectionString, world.GroupId));
    }
}
