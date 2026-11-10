using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>
/// C4 to C6 of E3.2: acceptances racing each other, the member ceiling and a revocation, on a real Postgres.
/// Every call of a round waits on one gate and is released together; each round is a new group. A gate
/// instead of a <see cref="Barrier"/>: sixteen blocked pool threads would wait for the pool to grow.
/// </summary>
public sealed class GroupsInviteConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Rounds = 5;
    private const int Racers = 16;
    private const int SeatRacers = 5;
    private const int RevocationRacers = 10;
    private const int MemberCeiling = 300;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>C4: one person, 16 times at once: one 201, fifteen 200, one member, one use.</summary>
    [Fact]
    public async Task SamePersonSixteenTimes_JoinsOnce()
    {
        for (var round = 0; round < Rounds; round++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);
            var (subject, user) = await world.RegisterPersonAsync();

            var responses = await RaceAsync(Enumerable.Repeat<Func<Task<HttpResponseMessage>>>(() => AcceptAsync(world, subject), Racers));

            Assert.Single(responses, response => response.Status == HttpStatusCode.Created);
            Assert.Equal(Racers - 1, responses.Count(response => response.Status == HttpStatusCode.OK));
            Assert.Single(responses.Select(response => response.MemberId).Distinct());
            Assert.Equal(1L, await ScalarAsync("SELECT count(*) FROM groups.members WHERE group_id = @group AND user_id = @user", world.GroupId, user));
            Assert.Equal(1, await UseCountAsync(world));
        }
    }

    /// <summary>C5: 16 people at once: sixteen 201, sixteen members, sixteen uses.</summary>
    [Fact]
    public async Task SixteenPeople_AllJoin()
    {
        for (var round = 0; round < Rounds; round++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);
            var subjects = await PeopleAsync(world, Racers);

            var responses = await RaceAsync(subjects.Select<string, Func<Task<HttpResponseMessage>>>(subject => () => AcceptAsync(world, subject)));

            Assert.All(responses, response => Assert.Equal(HttpStatusCode.Created, response.Status));
            Assert.Equal(Racers, responses.Select(response => response.MemberId).Distinct().Count());
            Assert.Equal(Racers, await UseCountAsync(world));
        }
    }

    /// <summary>C6: one seat left and five people at once: exactly one comes in, four get the member ceiling.</summary>
    [Fact]
    public async Task LastSeat_GoesToExactlyOne()
    {
        for (var round = 0; round < Rounds; round++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);
            await FillAsync(world, MemberCeiling - 1);
            var subjects = await PeopleAsync(world, SeatRacers);

            var responses = await RaceAsync(subjects.Select<string, Func<Task<HttpResponseMessage>>>(subject => () => AcceptAsync(world, subject)));

            Assert.Single(responses, response => response.Status == HttpStatusCode.Created);
            Assert.Equal(SeatRacers - 1, responses.Count(response => response.Status == HttpStatusCode.Conflict && response.Code == "groups.member-limit"));
            Assert.Equal((long)MemberCeiling, await ScalarAsync("SELECT count(*) FROM groups.members WHERE group_id = @group AND status = 'active'", world.GroupId));
            Assert.Equal(1, await UseCountAsync(world));
        }
    }

    /// <summary>
    /// C6: a revocation while ten people accept. Whoever the lock served before it is in, whoever after it gets
    /// the dead-link 404, and the use count matches exactly who came in.
    /// </summary>
    [Fact]
    public async Task RevocationDuringAcceptances_CountsOnlyWhoCameInBefore()
    {
        for (var round = 0; round < Rounds; round++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);
            var subjects = await PeopleAsync(world, RevocationRacers);
            var calls = subjects.Select<string, Func<Task<HttpResponseMessage>>>(subject => () => AcceptAsync(world, subject))
                .Append(() => world.SendAsync(GroupActor.Admin, HttpMethod.Delete, $"{world.InvitesPath}/{world.Invite.Id}"));

            var responses = await RaceAsync(calls);

            var joined = responses.Count(response => response.Status == HttpStatusCode.Created);
            Assert.Single(responses, response => response.Status == HttpStatusCode.NoContent);
            Assert.Equal(RevocationRacers - joined, responses.Count(response => response.Status == HttpStatusCode.NotFound && response.Code == "groups.invite-invalid"));
            Assert.Equal(joined, await UseCountAsync(world));
            Assert.Equal((long)joined, await ScalarAsync(
                "SELECT count(*) FROM groups.members WHERE group_id = @group AND status = 'active' AND role = 'player' AND user_id <> @user", world.GroupId, world.Users[GroupActor.Player]));
        }
    }

    private static Task<HttpResponseMessage> AcceptAsync(GroupWorld world, string subject) =>
        world.SendAsAsync(subject, HttpMethod.Post, GroupWorld.AcceptPath, GroupWorld.TokenBody(world.Invite.Token));

    private static async Task<IReadOnlyList<string>> PeopleAsync(GroupWorld world, int count)
    {
        var subjects = new List<string>();
        for (var person = 0; person < count; person++)
        {
            subjects.Add((await world.RegisterPersonAsync()).Subject);
        }

        return subjects;
    }

    private static async Task<RaceResponse[]> RaceAsync(IEnumerable<Func<Task<HttpResponseMessage>>> calls)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var racing = calls.Select(async call =>
        {
            await gate.Task;
            using var response = await call();
            var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
            var body = text.Length == 0 ? null : JsonNode.Parse(text)?.AsObject();
            return new RaceResponse(response.StatusCode, body?["memberId"]?.GetValue<Guid>(), body?["code"]?.GetValue<string>());
        }).ToList();
        gate.SetResult();
        return await Task.WhenAll(racing);
    }

    /// <summary>Active members without an account in Identity, straight to the table, until the group has <paramref name="total"/>.</summary>
    private async Task FillAsync(GroupWorld world, int total)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var insert = new NpgsqlCommand(
            """
            INSERT INTO groups.members (id, group_id, user_id, role, member_type, status, joined_at, left_at)
            SELECT gen_random_uuid(), @group, gen_random_uuid(), 'player', 'drop_in', 'active', now(), NULL
            FROM generate_series(1, @total - (SELECT count(*) FROM groups.members WHERE group_id = @group AND status = 'active'))
            """,
            connection);
        insert.Parameters.AddWithValue("group", world.GroupId);
        insert.Parameters.AddWithValue("total", (long)total);
        await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> UseCountAsync(GroupWorld world)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var select = new NpgsqlCommand("SELECT use_count FROM groups.invites WHERE id = @id", connection);
        select.Parameters.AddWithValue("id", world.Invite.Id);
        return (int)(await select.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private async Task<long> ScalarAsync(string sql, Guid group, Guid? user = null)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("group", group);
        if (user is { } value)
        {
            command.Parameters.AddWithValue("user", value);
        }

        return (long)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private sealed record RaceResponse(HttpStatusCode Status, Guid? MemberId, string? Code);
}
