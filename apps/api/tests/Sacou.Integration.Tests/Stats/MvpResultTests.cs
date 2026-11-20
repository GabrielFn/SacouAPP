using System.Net;
using System.Text.Json.Nodes;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Matches;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Stats;

/// <summary>
/// I8 to I10 and R3 of E3.18 part 2 (ADR 0072, D10 to D12) on the real API and a real Postgres: the result frozen at
/// the first read after the close, the MVP of the summary and of the profile after the vote, the export with only the
/// person's own votes, and a deleted account whose vote still counts. The Admin beats the Player 1-0; both vote.
/// </summary>
public sealed class MvpResultTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string VotingOn = """{"schemaVersion":1,"mvp":{"enabled":true,"voting":true}}""";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>
    /// I8: a tie on votes goes to the Admin by the balance. A match synced after the count, which would give the
    /// balance to the Player, changes the after-game but not the frozen winner nor how many voted.
    /// </summary>
    [Fact]
    public async Task I8_TheResult_IsFrozenAtTheFirstReadAfterTheClose()
    {
        using var client = api.CreateClient();
        var (world, round, phone, closesAt, _) = await VotedRoundAsync(client);
        var admin = world.MemberIds[A.Admin];

        var open = await ResultAsync(world, A.Player, round);
        Assert.Equal("open", open["state"]!.GetValue<string>());
        Assert.Null(open["winners"]);
        var whileOpen = await StatsCalls.SummaryAsync(world, A.Player, round);
        Assert.Equal("stats", whileOpen["mvp"]!["source"]!.GetValue<string>());
        Assert.Equal("open", whileOpen["mvpVoting"]!["state"]!.GetValue<string>());

        api.Clock.SetNow(closesAt);
        var counted = await ResultAsync(world, A.Player, round);
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("b"), phone.Point("b"), phone.ManualEnd("b")]);
        var later = await ResultAsync(world, A.Player, round);
        var summary = await StatsCalls.SummaryAsync(world, A.Player, round);

        Assert.Equal([admin], Winners(counted));
        Assert.Equal([admin], Winners(later));
        Assert.Equal(2, later["voters"]!.GetValue<int>());
        Assert.Equal("votes", summary["mvp"]!["source"]!.GetValue<string>());
        Assert.Equal(admin, summary["mvp"]!["memberIds"]!.AsArray().Single()!.GetValue<Guid>());
        Assert.Equal(-1, summary["mvp"]!["plusMinus"]!.GetValue<int>());
        Assert.Equal("closed", summary["mvpVoting"]!["state"]!.GetValue<string>());
        Assert.Null(summary["voters"]);
        Assert.Equal(1L, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM stats.mvp_results WHERE round_id = @id", Guid.Parse(round)));
    }

    /// <summary>S3: the closed result has only the winners and how many voted; R8: the profile counts the vote's MVP.</summary>
    [Fact]
    public async Task TheClosedResult_HasNoCountPerCandidate_AndTheProfileCountsItsMvp()
    {
        using var client = api.CreateClient();
        var (world, round, _, closesAt, year) = await VotedRoundAsync(client);
        api.Clock.SetNow(closesAt.AddMinutes(1));

        using var response = await world.SendAsync(A.Player, HttpMethod.Get, ResultPath(world, round));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var ofAdmin = await StatsCalls.MyStatsAsync(world, A.Admin, year);
        var ofPlayer = await StatsCalls.MyStatsAsync(world, A.Player, year);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.Equal(["state", "closesAt", "winners", "voters"], JsonNode.Parse(text)!.AsObject().Select(pair => pair.Key));
        Assert.Equal(1, ofAdmin["total"]!["mvpCount"]!.GetValue<int>());
        Assert.Equal(0, ofPlayer["total"]!["mvpCount"]!.GetValue<int>());
    }

    /// <summary>I9 and S5: the export of each person has only the vote they gave.</summary>
    [Fact]
    public async Task I9_TheExport_HasOnlyThePersonsOwnVote()
    {
        using var client = api.CreateClient();
        var (world, round, _, _, _) = await VotedRoundAsync(client);

        var ofPlayer = await ExportAsync(world, A.Player);
        var votes = ofPlayer["mvpVotes"]!.AsArray();

        var vote = Assert.Single(votes)!.AsObject();
        Assert.Equal(Guid.Parse(round), vote["roundId"]!.GetValue<Guid>());
        Assert.Equal(world.MemberIds[A.Admin], vote["candidateMemberId"]!.GetValue<Guid>());
        Assert.DoesNotContain(world.MemberIds[A.Player].ToString(), votes.ToJsonString(), StringComparison.OrdinalIgnoreCase);
        Assert.Empty((await ExportAsync(world, A.CoAdmin))["mvpVotes"]!.AsArray());
    }

    /// <summary>I10: the Player deletes the account after voting; the vote stays and still counts.</summary>
    [Fact]
    public async Task I10_ADeletedAccount_KeepsItsVoteCounted()
    {
        using var client = api.CreateClient();
        var (world, round, _, closesAt, _) = await VotedRoundAsync(client);

        using var deleted = await world.DeleteAccountAsync(A.Player);
        api.Clock.SetNow(closesAt);
        var result = await ResultAsync(world, A.Admin, round);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(2, result["voters"]!.GetValue<int>());
        Assert.Equal([world.MemberIds[A.Admin]], Winners(result));
        Assert.Equal(2L, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM stats.mvp_votes WHERE round_id = @id", Guid.Parse(round)));
    }

    /// <summary>Many first reads at once after the close freeze one row and answer with the same count.</summary>
    [Fact]
    public async Task ParallelFirstReads_FreezeASingleRow_WithTheSameCount()
    {
        using var client = api.CreateClient();
        var (world, round, _, closesAt, _) = await VotedRoundAsync(client);
        api.Clock.SetNow(closesAt);

        var results = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => ResultAsync(world, A.Player, round)));

        Assert.All(results, result => Assert.Equal([world.MemberIds[A.Admin]], Winners(result)));
        Assert.All(results, result => Assert.Equal(2, result["voters"]!.GetValue<int>()));
        Assert.Equal(1L, await CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM stats.mvp_results WHERE round_id = @id", Guid.Parse(round)));
    }

    /// <summary>People outside the group, removed or gone get the same 404; while open there are no winners nor voters.</summary>
    [Fact]
    public async Task TheResultAccess_IsTheSame404ForAnyoneOutside_AndHasNoCountWhileOpen()
    {
        using var client = api.CreateClient();
        var (world, round, _, closesAt, _) = await VotedRoundAsync(client);

        var open = await ResultAsync(world, A.Player, round);
        var outside = new List<string>();
        foreach (var actor in new[] { A.NonMember, A.OutsiderMember, A.RemovedMember, A.LeftMember })
        {
            using var response = await world.SendAsync(actor, HttpMethod.Get, ResultPath(world, round));
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            outside.Add(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        Assert.Single(outside.Select(body => JsonNode.Parse(body)!["code"]?.ToString() ?? JsonNode.Parse(body)!["type"]?.ToString()).Distinct());
        Assert.Equal("open", open["state"]!.GetValue<string>());
        Assert.Null(open["winners"]);
        Assert.Null(open["voters"]);
        api.Clock.SetNow(closesAt);
        var closed = (await ResultAsync(world, A.Admin, round)).ToJsonString();
        Assert.DoesNotContain("count", closed, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("votes", closed, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>The Admin's export has the vote the Admin gave, never the one received nor another person's.</summary>
    [Fact]
    public async Task TheExport_HasNoReceivedVoteNorAnotherPersonsVote()
    {
        using var client = api.CreateClient();
        var (world, _, _, _, _) = await VotedRoundAsync(client);

        var votes = (await ExportAsync(world, A.Admin))["mvpVotes"]!.AsArray();

        var vote = Assert.Single(votes)!.AsObject();
        Assert.Equal(world.MemberIds[A.Player], vote["candidateMemberId"]!.GetValue<Guid>());
        Assert.DoesNotContain(world.MemberIds[A.Admin].ToString(), votes.ToJsonString(), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// A round with the vote on: the Admin beats the Player 1-0, the round is closed an hour after its start, and each
    /// votes for the other (a tie on votes, the Admin ahead on the balance).
    /// </summary>
    private async Task<(GroupWorld World, string Round, CourtPhone Phone, DateTimeOffset ClosesAt, string Year)> VotedRoundAsync(HttpClient client)
    {
        var world = await GroupWorld.CreateAsync(api, client);
        var date = RoundCalls.FutureDate();
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(date, settings: VotingOn));
        var round = created["roundId"]!.GetValue<string>();
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a"), phone.ManualEnd("a")]);
        api.Clock.SetNow(created["startsAt"]!.GetValue<DateTimeOffset>().AddHours(1));
        using var close = await world.SendAsync(A.Scorekeeper, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        var closedAt = JsonNode.Parse(await close.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!["closedAt"]!.GetValue<DateTimeOffset>();
        await VoteAsync(world, A.Admin, round, world.MemberIds[A.Player]);
        await VoteAsync(world, A.Player, round, world.MemberIds[A.Admin]);
        return (world, round, phone, closedAt.AddHours(24), date[..4]);
    }

    private static async Task VoteAsync(GroupWorld world, A actor, string round, Guid candidate)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Post, $"{RoundCalls.RoundPath(world, round)}/mvp-voting/vote",
            $$"""{"candidateMemberId":"{{candidate}}"}""");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static string ResultPath(GroupWorld world, string round) => $"{RoundCalls.RoundPath(world, round)}/mvp-voting/result";

    private static async Task<JsonObject> ResultAsync(GroupWorld world, A actor, string round)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, ResultPath(world, round));
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        return JsonNode.Parse(body)!.AsObject();
    }

    private static List<Guid> Winners(JsonObject result) => [.. result["winners"]!.AsArray().Select(winner => winner!.GetValue<Guid>())];

    private static async Task<JsonObject> ExportAsync(GroupWorld world, A actor)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, "/v1/me/export");
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        return JsonNode.Parse(body)!.AsObject();
    }
}
