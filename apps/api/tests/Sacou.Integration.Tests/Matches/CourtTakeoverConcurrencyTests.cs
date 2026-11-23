using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// A4 of E3.8 (ADR 0063, D1 to D3): the takeover and the write share the stream's lock, so one of the two outcomes of
/// D2 always wins and never both, nor a 500.
/// </summary>
public sealed class CourtTakeoverConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Races = 20;
    private const int Resends = 8;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>A write of the writer and a takeover at once, 20 times: either the write stores and the takeover is stale, or the reverse.</summary>
    [Fact]
    public async Task AWriteAndATakeoverAtOnce_OnlyOneWins()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var writer = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, writer, [writer.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        var (batch, count, writerActor, challengerActor) = (1L, 1L, A.Scorekeeper, A.CoAdmin);

        for (var race = 0; race < Races; race++)
        {
            var challenger = writer.TakingOver(batch + 1);
            var write = CourtCalls.SendAsync(world, writerActor, round, writer, [writer.Point(race % 2 == 0 ? "a" : "b")]);
            var takeover = CourtCalls.TakeOverAsync(world, challengerActor, round, challenger, batch, count);
            using var written = await write;
            using var taken = await takeover;

            if (written.StatusCode == HttpStatusCode.OK)
            {
                Assert.Equal(HttpStatusCode.Conflict, taken.StatusCode);
                Assert.Equal("matches.stream-changed", await RoundCalls.CodeAsync(taken));
                count++;
            }
            else
            {
                Assert.Equal(HttpStatusCode.OK, taken.StatusCode);
                Assert.Equal(HttpStatusCode.Conflict, written.StatusCode);
                Assert.Equal("matches.not-the-writer", await RoundCalls.CodeAsync(written));
                (writer, batch, writerActor, challengerActor) = (challenger, batch + 1, challengerActor, writerActor);
            }

            Assert.Equal(count, await CourtCalls.EventCountAsync(api.ConnectionString, writer.CourtSessionId));
            Assert.Equal(batch, await WritersAsync(writer.CourtSessionId));
        }
    }

    /// <summary>Two phones take over with the same confirmation at once: one gets the batch, the other <c>stream-changed</c>.</summary>
    [Fact]
    public async Task TwoTakeoversAtOnce_OneWins()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        var first = CourtCalls.TakeOverAsync(world, A.CoAdmin, round, phone.TakingOver(2), 1, 1);
        var second = CourtCalls.TakeOverAsync(world, A.Admin, round, phone.TakingOver(2), 1, 1);
        using var one = await first;
        using var other = await second;

        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.Conflict], new[] { one.StatusCode, other.StatusCode }.Order());
        var loser = one.StatusCode == HttpStatusCode.OK ? other : one;
        Assert.Equal("matches.stream-changed", await RoundCalls.CodeAsync(loser));
        Assert.Equal(2, await WritersAsync(phone.CourtSessionId));
    }

    /// <summary>The same takeover sent 8 times at once opens one batch; every answer is that batch.</summary>
    [Fact]
    public async Task EightResendsOfOneTakeover_OpenOneBatch()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);
        var other = phone.TakingOver(2);

        var taken = await Task.WhenAll(Enumerable.Range(0, Resends).Select(_ => CourtCalls.TakenOverAsync(world, A.CoAdmin, round, other, 1, 1)));

        Assert.All(taken, answer => Assert.Equal((2L, 1L, 0L, 1L), answer));
        Assert.Equal(2, await WritersAsync(phone.CourtSessionId));
    }

    private Task<long> WritersAsync(Guid courtSessionId) =>
        CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM matches.court_writers WHERE court_session_id = @id", courtSessionId);
}
