using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Matches;

/// <summary>C1 of E3.7: the stream's lock serializes resends and creations, with no deadlock and no 500 (ADR 0060, D6 and D7).</summary>
public sealed class CourtConcurrencyTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Requests = 16;
    private const int Rounds = 5;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>16 copies of the same new batch at once: one stores it, the other 15 store nothing; five times over.</summary>
    [Fact]
    public async Task SixteenResends_StoreOnce()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        for (var attempt = 0; attempt < Rounds; attempt++)
        {
            string[] batch = [.. phone.AlternatingPoints(2)];
            var written = await Task.WhenAll(Enumerable.Range(0, Requests).Select(_ => CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, batch)));

            var expectedLast = 1 + (2 * (attempt + 1));
            Assert.All(written, result => Assert.Equal(expectedLast, result.LastSequence));
            Assert.Equal(2, written.Sum(result => result.Stored));
        }

        Assert.Equal(1 + (2 * Rounds), await CourtCalls.EventCountAsync(api.ConnectionString, phone.CourtSessionId));
    }

    /// <summary>Two creations of the same stream make one row; two streams for one round: one 200 and one 409.</summary>
    [Fact]
    public async Task ConcurrentCreations_MakeOneStreamPerRound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var sameStream = await CourtCalls.RoundAsync(world);
        var twoStreams = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        string[] first = [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])];
        var left = CourtPhone.New();
        var right = CourtPhone.New();

        var same = await Task.WhenAll(CourtCalls.AcceptedAsync(world, A.Admin, sameStream, phone, first), CourtCalls.AcceptedAsync(world, A.Admin, sameStream, phone, first));
        var racing = await Task.WhenAll(
            CourtCalls.SendAsync(world, A.Admin, twoStreams, left, [left.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]),
            CourtCalls.SendAsync(world, A.CoAdmin, twoStreams, right, [right.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]));

        Assert.Equal(1, same.Sum(result => result.Stored));
        Assert.Equal([HttpStatusCode.OK, HttpStatusCode.Conflict], racing.Select(response => response.StatusCode).Order());
        var refused = racing.Single(response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal("matches.round-has-court-session", await RoundCalls.CodeAsync(refused));
        foreach (var response in racing)
        {
            response.Dispose();
        }
    }
}
