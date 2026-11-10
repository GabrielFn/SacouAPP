using System.Net;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>
/// C1 to C7 of E3.4: many calls leave a barrier together against a real Postgres, five times each. The rule is
/// the round's lock (<c>SELECT ... FOR UPDATE</c>): the spots and the order of the line are decided one call at a time.
/// </summary>
public sealed class RoundConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Repetitions = 5;
    private const int Capacity = 12;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>C1: 12 spots, 11 taken, 16 different members say "vou" together: one goes, fifteen wait in places 1 to 15.</summary>
    [Fact]
    public async Task SixteenAtTheLastSpot_GiveExactlyOneGoing_AndFifteenInLine()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var (world, round, people) = await PreparedAsync(taken: Capacity - 1, racers: 16);

            var results = await RaceAsync(people.Select(person => (Func<Task<(HttpStatusCode, string?, System.Text.Json.Nodes.JsonObject?)>>)(
                () => RoundCalls.RespondAsync(world, person.Subject, round, going: true))));

            Assert.All(results, result => Assert.Equal(HttpStatusCode.OK, result.Item1));
            var rows = await RoundCalls.RowsAsync(api.ConnectionString, round);
            Assert.Equal(Capacity - 1 + 16, rows.Count);
            Assert.Equal(1, rows.Count(row => row.Status == "going" && people.Any(person => person.MemberId == row.MemberId)));
            var waiting = rows.Where(row => row.Status == "waitlisted").OrderBy(row => row.Sequence).ToList();
            Assert.Equal(15, waiting.Count);
            var positions = results.Where(result => result.Item3!["status"]!.GetValue<string>() == "waitlisted")
                .Select(result => result.Item3!["position"]!.GetValue<int>()).Order();
            Assert.Equal(Enumerable.Range(1, 15), positions);
            Assert.Equal(rows.Count, rows.Select(row => row.Sequence).Distinct().Count());
        }
    }

    /// <summary>C2, the acceptance: two at the last spot. One goes, the other is first in line, and both answers agree with the table.</summary>
    [Fact]
    public async Task TwoAtTheLastSpot_OneGoes_TheOtherIsFirstInLine()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var (world, round, people) = await PreparedAsync(taken: Capacity - 1, racers: 2);

            var results = await RaceAsync(people.Select(person => (Func<Task<(HttpStatusCode, string?, System.Text.Json.Nodes.JsonObject?)>>)(
                () => RoundCalls.RespondAsync(world, person.Subject, round, going: true))));

            Assert.All(results, result => Assert.Equal(HttpStatusCode.OK, result.Item1));
            var statuses = results.Select(result => result.Item3!["status"]!.GetValue<string>()).Order().ToList();
            Assert.Equal(["going", "waitlisted"], statuses);
            var waiting = results.Single(result => result.Item3!["status"]!.GetValue<string>() == "waitlisted");
            Assert.Equal(1, waiting.Item3!["position"]!.GetValue<int>());
            var rows = await RoundCalls.RowsAsync(api.ConnectionString, round);
            Assert.Equal(Capacity, rows.Count(row => row.Status == "going"));
            Assert.Single(rows, row => row.Status == "waitlisted");
        }
    }

    /// <summary>C3: someone gives up while two more say "vou" on a full round: the spots stay full and the first in line is promoted.</summary>
    [Fact]
    public async Task GivingUpAndTwoJoining_OnAFullRound_KeepTheSpotsFull()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var (world, round, people) = await PreparedAsync(taken: Capacity, racers: 3);
            _ = await RoundCalls.RespondAsync(world, people[0].Subject, round, going: true);
            var leaver = (await RoundCalls.RowsAsync(api.ConnectionString, round)).First(row => row.Status == "going").MemberId;

            var calls = new List<Func<Task<HttpStatusCode>>>
            {
                () => RoundCalls.SetAsync(world, round, leaver, going: false),
                async () => (await RoundCalls.RespondAsync(world, people[1].Subject, round, going: true)).Status,
                async () => (await RoundCalls.RespondAsync(world, people[2].Subject, round, going: true)).Status,
            };
            var statuses = await RaceAsync(calls);

            Assert.All(statuses, status => Assert.Equal(HttpStatusCode.OK, status));
            var rows = await RoundCalls.RowsAsync(api.ConnectionString, round);
            Assert.Equal(Capacity, rows.Count(row => row.Status is "going" or "promoted"));
            Assert.Equal(people[0].MemberId, rows.Where(row => row.Status == "promoted").Select(row => row.MemberId).Single());
        }
    }

    /// <summary>C4: a double tap is one row, one sequence.</summary>
    [Fact]
    public async Task DoubleTap_IsOneRowAndOneSequence()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var (world, round, people) = await PreparedAsync(taken: 0, racers: 1);

            var results = await RaceAsync(Enumerable.Range(0, 2).Select(_ => (Func<Task<(HttpStatusCode, string?, System.Text.Json.Nodes.JsonObject?)>>)(
                () => RoundCalls.RespondAsync(world, people[0].Subject, round, going: true))));

            Assert.All(results, result => Assert.Equal(HttpStatusCode.OK, result.Item1));
            var rows = await RoundCalls.RowsAsync(api.ConnectionString, round);
            var mine = Assert.Single(rows);
            Assert.Equal("going", mine.Status);
            Assert.Equal(1, mine.Sequence);
        }
    }

    /// <summary>C5: two reads of a series with no upcoming round make one round, and the mensalistas are confirmed once.</summary>
    [Fact]
    public async Task TwoReadsOfASeriesWithoutAnUpcomingRound_MakeOneRound()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            using var client = api.CreateClient();
            var world = await GroupWorld.CreateAsync(api, client);
            await RoundCalls.ConfigureAttendanceAsync(world, regulars: true);
            _ = await world.AddPersonAsync(memberType: "regular");
            var first = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(repeat: true));
            await ExpireAsync(first["roundId"]!.GetValue<string>());

            var lists = await RaceAsync(Enumerable.Range(0, 2).Select(_ => (Func<Task<HttpStatusCode>>)(async () =>
            {
                using var response = await world.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundsPath(world));
                return response.StatusCode;
            })));

            Assert.All(lists, status => Assert.Equal(HttpStatusCode.OK, status));
            Assert.Equal(1, await CountAsync("SELECT count(*) FROM sessions.rounds WHERE series_id = @s", Guid.Parse(first["seriesId"]!.GetValue<string>())) - 1);
        }
    }

    /// <summary>C6: the admin raises the spots while five avulsos say "vou": never more people in spots than the final capacity.</summary>
    [Fact]
    public async Task RaisingTheSpots_WhileFiveJoin_NeverOverfills()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var (world, round, people) = await PreparedAsync(taken: 4, racers: 5, capacity: 5);
            var calls = new List<Func<Task<HttpStatusCode>>>
            {
                async () =>
                {
                    using var response = await world.SendAsync(A.Admin, HttpMethod.Patch, RoundCalls.RoundPath(world, round),
                        """{"settings":{"schemaVersion":1,"attendance":{"capacity":7}}}""");
                    return response.StatusCode;
                },
            };
            calls.AddRange(people.Select(person => (Func<Task<HttpStatusCode>>)(async () => (await RoundCalls.RespondAsync(world, person.Subject, round, going: true)).Status)));

            var statuses = await RaceAsync(calls);

            Assert.All(statuses, status => Assert.Equal(HttpStatusCode.OK, status));
            var rows = await RoundCalls.RowsAsync(api.ConnectionString, round);
            Assert.Equal(7, rows.Count(row => row.Status is "going" or "promoted"));
            Assert.Equal(2, rows.Count(row => row.Status == "waitlisted"));
        }
    }

    /// <summary>C7: a write on a round and a patch on the group's settings together: no deadlock, both finish.</summary>
    [Fact]
    public async Task RoundWriteAndGroupSettingsPatch_BothFinish()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var (world, round, people) = await PreparedAsync(taken: 0, racers: 3);
            var calls = new List<Func<Task<HttpStatusCode>>>
            {
                async () =>
                {
                    using var response = await world.SendAsync(A.Admin, HttpMethod.Patch, world.GroupPath + "/settings", """{"settings":{"schemaVersion":1,"scoring":{"bestOf":3}}}""");
                    return response.StatusCode;
                },
            };
            calls.AddRange(people.Select(person => (Func<Task<HttpStatusCode>>)(async () => (await RoundCalls.RespondAsync(world, person.Subject, round, going: true)).Status)));

            var statuses = await RaceAsync(calls);

            Assert.All(statuses, status => Assert.Equal(HttpStatusCode.OK, status));
        }
    }

    private async Task<(GroupWorld World, string Round, List<(string Subject, Guid MemberId)> Racers)> PreparedAsync(
        int taken, int racers, int capacity = Capacity)
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        for (var index = 0; index < taken; index++)
        {
            var filler = await world.AddPersonAsync();
            Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, filler.MemberId, going: true));
        }

        var people = new List<(string, Guid)>();
        for (var index = 0; index < racers; index++)
        {
            people.Add(await world.AddPersonAsync());
        }

        return (world, round, people);
    }

    private static async Task<T[]> RaceAsync<T>(IEnumerable<Func<Task<T>>> calls)
    {
        var all = calls.ToList();
        using var gate = new Barrier(all.Count);
        return await Task.WhenAll(all.Select(async call =>
        {
            await Task.Yield();
            gate.SignalAndWait(TestContext.Current.CancellationToken);
            return await call();
        }));
    }

    /// <summary>Moves the round into the past, so the series has no upcoming round left.</summary>
    private async Task ExpireAsync(string round)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var update = new Npgsql.NpgsqlCommand(
            "UPDATE sessions.rounds SET starts_at = starts_at - interval '30 days', local_date = local_date - 30 WHERE id = @id", connection);
        update.Parameters.AddWithValue("id", Guid.Parse(round));
        await update.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task<long> CountAsync(string sql, Guid parameter)
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        await using var count = new Npgsql.NpgsqlCommand(sql, connection);
        count.Parameters.AddWithValue("s", parameter);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }
}
