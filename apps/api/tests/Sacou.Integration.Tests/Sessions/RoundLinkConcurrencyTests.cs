using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Xunit;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>
/// Case 16 of the E3.12 plan: C1 of the E3.4 through the link, with every racer a stranger who comes into the group on
/// the way. The group's lock and then the round's lock decide, one call at a time, never both held together.
/// </summary>
public sealed class RoundLinkConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Repetitions = 2;
    private const int Capacity = 12;
    private const int Racers = 16;

    private readonly ApiWithDatabase api = new(database);
    private readonly List<HttpClient> clients = [];

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync()
    {
        clients.ForEach(client => client.Dispose());
        await api.DisposeAsync();
    }

    [Fact]
    public async Task SixteenStrangersAtTheLastSpot_GiveOneGoing_FifteenInLine_AndSixteenNewMembers()
    {
        for (var repetition = 0; repetition < Repetitions; repetition++)
        {
            var (world, round, code) = await PreparedAsync(taken: Capacity - 1);
            var strangers = new List<(string Subject, Guid User)>();
            for (var index = 0; index < Racers; index++)
            {
                strangers.Add(await world.RegisterPersonAsync());
            }

            var results = await RaceAsync(strangers.Select(stranger => (Func<Task<(HttpStatusCode Status, JsonObject Body)>>)(
                () => RoundLinkCalls.AnswerAsync(world, stranger.Subject, code))));

            Assert.All(results, result => Assert.Equal(HttpStatusCode.OK, result.Status));
            Assert.All(results, result => Assert.True(result.Body["joined"]!.GetValue<bool>()));
            Assert.Single(results, result => result.Body["status"]!.GetValue<string>() == "going");
            var positions = results.Where(result => result.Body["status"]!.GetValue<string>() == "waitlisted")
                .Select(result => result.Body["position"]!.GetValue<int>()).Order();
            Assert.Equal(Enumerable.Range(1, Racers - 1), positions);
            foreach (var stranger in strangers)
            {
                Assert.Equal("active", (await RoundLinkCalls.MemberOfAsync(api.ConnectionString, world.GroupId, stranger.User))!.Value.Status);
            }

            var rows = await RoundCalls.RowsAsync(api.ConnectionString, round);
            Assert.Equal(Capacity - 1 + Racers, rows.Count);
        }
    }

    /// <summary>The same stranger twice at once: one member, one attendance.</summary>
    [Fact]
    public async Task OneStrangerTwiceAtOnce_IsOneMember_AndOneAttendance()
    {
        var (world, round, code) = await PreparedAsync(taken: 0);
        var stranger = await world.RegisterPersonAsync();

        var results = await RaceAsync(Enumerable.Range(0, 2).Select(_ => (Func<Task<(HttpStatusCode Status, JsonObject Body)>>)(
            () => RoundLinkCalls.AnswerAsync(world, stranger.Subject, code))));

        Assert.All(results, result => Assert.Equal(HttpStatusCode.OK, result.Status));
        Assert.Single(results, result => result.Body["joined"]!.GetValue<bool>());
        Assert.Single(results.Select(result => result.Body["memberId"]!.GetValue<Guid>()).Distinct());
        Assert.Single(await RoundCalls.RowsAsync(api.ConnectionString, round));
    }

    private async Task<(GroupWorld World, string Round, string Code)> PreparedAsync(int taken)
    {
        var client = api.CreateClient();
        clients.Add(client);
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, Capacity);
        var (round, code) = await RoundLinkCalls.RoundAsync(world);
        for (var index = 0; index < taken; index++)
        {
            var filler = await world.AddPersonAsync();
            Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, filler.MemberId, going: true));
        }

        return (world, round, code);
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
}
