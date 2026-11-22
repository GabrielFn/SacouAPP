using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Matches;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Stats;

/// <summary>
/// I1 to I7 of E3.18 (ADR 0072) on the real API and a real Postgres: the vote stored and read back as one's own, the
/// race of one member and of two, the CHECK of the table, the close under the lock (and refused before the start), the actor matrix, a guest as candidate, a late match that makes a member
/// eligible, and the secret of the ballot. The Admin plays the Player in one finished match; the Co-admin never plays.
/// </summary>
public sealed class MvpVotingTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int RacingVotes = 20;
    private const int RoundAfterTheOpenOne = 6;
    private const string VotingOn = """{"schemaVersion":1,"mvp":{"enabled":true,"voting":true}}""";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>I1 and S2: the vote comes back only as the voter's own; the other player's ballot has no trace of it.</summary>
    [Fact]
    public async Task I1_AVote_IsStored_AndReadBackOnlyByTheVoter()
    {
        using var client = api.CreateClient();
        var (world, round) = await OpenRoundAsync(client);

        using var cast = await VoteAsync(world, A.Admin, round, world.MemberIds[A.Player]);
        Assert.Equal(HttpStatusCode.Created, cast.StatusCode);
        Assert.Equal("no-store", cast.Headers.CacheControl?.ToString());

        var ofAdmin = await BallotAsync(world, A.Admin, round);
        Assert.Equal(world.MemberIds[A.Player], ofAdmin["myVote"]!["candidateMemberId"]!.GetValue<Guid>());
        Assert.False(ofAdmin["canVote"]!.GetValue<bool>());
        var ofPlayer = await BallotTextAsync(world, A.Player, round);
        Assert.DoesNotContain("\"candidateMemberId\"", ofPlayer, StringComparison.Ordinal);
        Assert.Equal(1, await VotesAsync(round));
    }

    /// <summary>I2: twenty votes of the same member at once store one row; the others are 409.</summary>
    [Fact]
    public async Task I2_TwentyVotesOfOneMemberAtOnce_StoreOne()
    {
        using var client = api.CreateClient();
        var (world, round) = await OpenRoundAsync(client);

        var answers = await Task.WhenAll(Enumerable.Range(0, RacingVotes).Select(async _ =>
        {
            using var response = await VoteAsync(world, A.Admin, round, world.MemberIds[A.Player]);
            return (response.StatusCode, Code: await RoundCalls.CodeAsync(response));
        }));

        Assert.Equal(1, answers.Count(answer => answer.StatusCode == HttpStatusCode.Created));
        Assert.All(answers.Where(answer => answer.StatusCode != HttpStatusCode.Created), answer =>
        {
            Assert.Equal(HttpStatusCode.Conflict, answer.StatusCode);
            Assert.Equal("stats.mvp-already-voted", answer.Code);
        });
        Assert.Equal(1, await VotesAsync(round));
    }

    /// <summary>I3: two members voting at once both store their vote.</summary>
    [Fact]
    public async Task I3_TwoMembersAtOnce_BothStore()
    {
        using var client = api.CreateClient();
        var (world, round) = await OpenRoundAsync(client);

        var answers = await Task.WhenAll(
            StatusAsync(VoteAsync(world, A.Admin, round, world.MemberIds[A.Player])),
            StatusAsync(VoteAsync(world, A.Player, round, world.MemberIds[A.Admin])));

        Assert.All(answers, status => Assert.Equal(HttpStatusCode.Created, status));
        Assert.Equal(2, await VotesAsync(round));
    }

    /// <summary>I4: the table refuses a vote for oneself even from a direct insert.</summary>
    [Fact]
    public async Task I4_TheTable_RefusesAVoteForOneself()
    {
        var member = Guid.NewGuid();

        var refused = await Assert.ThrowsAsync<PostgresException>(() => CourtCalls.ExecuteAsync(
            api.ConnectionString,
            "INSERT INTO stats.mvp_votes (round_id, voter_member_id, group_id, candidate_member_id, cast_at) VALUES (@round, @member, @group, @member, now())",
            ("round", Guid.NewGuid()), ("member", member), ("group", Guid.NewGuid())));

        Assert.Equal(PostgresErrorCodes.CheckViolation, refused.SqlState);
        Assert.Equal("ck_mvp_votes_not_self", refused.ConstraintName);
    }

    /// <summary>ADR 0076: before the start a round with one finished match closes at the tap; without a match it is still refused.</summary>
    [Fact]
    public async Task ARoundWithAFinishedMatch_ClosesBeforeItsStart()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(settings: VotingOn));
        var round = created["roundId"]!.GetValue<string>();
        var startsAt = created["startsAt"]!.GetValue<DateTimeOffset>();
        var tap = startsAt.AddHours(-1);
        api.Clock.SetNow(tap);

        using var withoutMatch = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        Assert.Equal("sessions.round-not-started", await RoundCalls.CodeAsync(withoutMatch));
        _ = await PlayAsync(world, round);
        var closed = await CloseAsync(world, A.Scorekeeper, round);

        Assert.Equal(tap, closed["closedAt"]!.GetValue<DateTimeOffset>());
        Assert.Equal(tap, closed["endsAt"]!.GetValue<DateTimeOffset>());
    }

    /// <summary>I5: a round made before the column has no close, so it ends on its own.</summary>
    [Fact]
    public async Task I5_ARoundWithoutClose_EndsSixHoursAfterItsStart()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(settings: VotingOn));

        Assert.Null(round["closedAt"]);
        Assert.Equal(round["startsAt"]!.GetValue<DateTimeOffset>().AddHours(6), round["endsAt"]!.GetValue<DateTimeOffset>());
    }

    /// <summary>
    /// I6 and J6: before the start the close is refused; two closes at once store one instant; closing again answers it;
    /// a cancelled round does not close.
    /// </summary>
    [Fact]
    public async Task I6_ConcurrentCloses_StoreOneInstant()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(settings: VotingOn));
        var round = created["roundId"]!.GetValue<string>();
        var cancelled = (await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(RoundCalls.FutureDate(4), settings: VotingOn)))["roundId"]!.GetValue<string>();
        using var cancel = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, cancelled) + "/cancel");
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        using var early = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        Assert.Equal("sessions.round-not-started", await RoundCalls.CodeAsync(early));
        StartRound(created);
        var closes = await Task.WhenAll(CloseAsync(world, A.Scorekeeper, round), CloseAsync(world, A.Admin, round));
        var again = await CloseAsync(world, A.CoAdmin, round);

        Assert.Equal(closes[0]["closedAt"]!.GetValue<DateTimeOffset>(), closes[1]["closedAt"]!.GetValue<DateTimeOffset>());
        Assert.Equal(closes[0]["closedAt"]!.GetValue<DateTimeOffset>(), again["closedAt"]!.GetValue<DateTimeOffset>());
        using var byPlayer = await world.SendAsync(A.Player, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        Assert.Equal(HttpStatusCode.Forbidden, byPlayer.StatusCode);
        using var closedCancelled = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, cancelled) + "/close");
        Assert.Equal("sessions.round-canceled", await RoundCalls.CodeAsync(closedCancelled));
    }

    /// <summary>
    /// The actor matrix of the three routes (vote, ballot, close): someone from outside, a removed member and a former
    /// member get the very same 404 on each; the Player gets 403 on the close; the Scorekeeper closes.
    /// </summary>
    [Fact]
    public async Task TheActorMatrix_OfTheVote_TheBallot_AndTheClose()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(settings: VotingOn));
        var round = created["roundId"]!.GetValue<string>();
        _ = await PlayAsync(world, round);
        StartRound(created);
        var vote = $$"""{"candidateMemberId":"{{world.MemberIds[A.Player]}}"}""";
        var routes = new (HttpMethod Method, string Path, string? Body)[]
        {
            (HttpMethod.Post, VotePath(world, round), vote),
            (HttpMethod.Get, BallotPath(world, round), null),
            (HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close", null),
        };

        foreach (var (method, path, body) in routes)
        {
            var problems = new List<string>();
            foreach (var outsider in new[] { A.NonMember, A.RemovedMember, A.LeftMember })
            {
                using var refused = await world.SendAsync(outsider, method, path, body);
                Assert.Equal(HttpStatusCode.NotFound, refused.StatusCode);
                problems.Add(await CourtCalls.ProblemWithoutTraceAsync(refused));
            }

            Assert.Single(problems.Distinct(StringComparer.Ordinal));
        }

        using var byPlayer = await world.SendAsync(A.Player, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        Assert.Equal(HttpStatusCode.Forbidden, byPlayer.StatusCode);
        var closed = await CloseAsync(world, A.Scorekeeper, round);
        Assert.NotNull(closed["closedAt"]);
        Assert.Equal(0, await VotesAsync(round));
    }

    /// <summary>E6: a guest who played is on the ballot and takes a vote (a guest has no login, so never votes).</summary>
    [Fact]
    public async Task E6_AGuestWhoPlayed_TakesAVote()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(settings: VotingOn));
        var round = created["roundId"]!.GetValue<string>();
        var guest = await GuestCalls.CreateAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], guest), phone.Point("a"), phone.ManualEnd("a")]);
        StartRound(created);
        _ = await CloseAsync(world, A.Scorekeeper, round);

        using var cast = await VoteAsync(world, A.Admin, round, guest);

        Assert.Equal(HttpStatusCode.Created, cast.StatusCode);
        Assert.Equal(1, await VotesAsync(round));
    }

    /// <summary>I7: a match synced after the close makes its players eligible; before it, the Co-admin had not played.</summary>
    [Fact]
    public async Task I7_AMatchSyncedAfterTheClose_MakesItsPlayersEligible()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(settings: VotingOn));
        var round = created["roundId"]!.GetValue<string>();
        var phone = await PlayAsync(world, round);
        StartRound(created);
        _ = await CloseAsync(world, A.Scorekeeper, round);
        using var before = await VoteAsync(world, A.CoAdmin, round, world.MemberIds[A.Player]);
        Assert.Equal("stats.mvp-voter-not-eligible", await RoundCalls.CodeAsync(before));

        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.CoAdmin], world.MemberIds[A.Scorekeeper]), phone.Point("a"), phone.ManualEnd("a")]);

        using var after = await VoteAsync(world, A.CoAdmin, round, world.MemberIds[A.Player]);
        Assert.Equal(HttpStatusCode.Created, after.StatusCode);
    }

    /// <summary>E5, E9, E10, E11 and E12 on the route: the refusals and their codes, none of them echoing the candidate.</summary>
    [Fact]
    public async Task TheRefusals_HaveTheirCodes_AndNeverEchoTheCandidate()
    {
        using var client = api.CreateClient();
        var (world, round) = await OpenRoundAsync(client);
        var stranger = world.MemberIds[A.OutsiderMember];

        using var self = await VoteAsync(world, A.Admin, round, world.MemberIds[A.Admin]);
        using var outsider = await VoteAsync(world, A.Admin, round, stranger);
        var outsiderText = await outsider.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var notAnId = await world.SendAsync(A.Admin, HttpMethod.Post, VotePath(world, round), """{"candidateMemberId":"bia-123"}""");
        using var empty = await world.SendAsync(A.Admin, HttpMethod.Post, VotePath(world, round), "{}");
        using var nonMember = await VoteAsync(world, A.NonMember, round, world.MemberIds[A.Player]);
        using var ballotOfOutsider = await world.SendAsync(A.OutsiderMember, HttpMethod.Get, BallotPath(world, round));

        Assert.Equal("stats.mvp-self-vote", await RoundCalls.CodeAsync(self));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, outsider.StatusCode);
        Assert.Contains("stats.mvp-candidate-invalid", outsiderText, StringComparison.Ordinal);
        Assert.DoesNotContain(stranger.ToString(), outsiderText, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("stats.mvp-vote-invalid", await RoundCalls.CodeAsync(notAnId));
        Assert.DoesNotContain("bia-123", await notAnId.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
        Assert.Equal("stats.mvp-vote-invalid", await RoundCalls.CodeAsync(empty));
        Assert.Equal(HttpStatusCode.NotFound, nonMember.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, ballotOfOutsider.StatusCode);
        Assert.Equal(0, await VotesAsync(round));
    }

    /// <summary>E9 and E10: a cancelled round is the 404 of a missing one; the vote off on the round is its own 404.</summary>
    [Fact]
    public async Task ACancelledRound_AndTheVoteOff_Are404()
    {
        using var client = api.CreateClient();
        var (world, round) = await OpenRoundAsync(client);
        // The clock already stands past the first round's start, so this one goes further ahead.
        var off = (await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(RoundCalls.FutureDate(RoundAfterTheOpenOne))))["roundId"]!.GetValue<string>();
        using var cancel = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel");

        using var canceled = await world.SendAsync(A.Admin, HttpMethod.Get, BallotPath(world, round));
        using var missing = await world.SendAsync(A.Admin, HttpMethod.Get, BallotPath(world, Guid.NewGuid().ToString()));
        using var votingOff = await world.SendAsync(A.Admin, HttpMethod.Get, BallotPath(world, off));

        Assert.Equal(CourtCalls.RoundNotFound, await RoundCalls.CodeAsync(canceled));
        Assert.Equal(CourtCalls.RoundNotFound, await RoundCalls.CodeAsync(missing));
        Assert.Equal("stats.mvp-voting-off", await RoundCalls.CodeAsync(votingOff));
        Assert.Equal("no-store", canceled.Headers.CacheControl?.ToString());
    }

    /// <summary>E7 and E8: before the end it is not open; 24 hours after it, closed.</summary>
    [Fact]
    public async Task TheWindow_OpensAtTheEnd_AndClosesADayLater()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(settings: VotingOn));
        var round = created["roundId"]!.GetValue<string>();
        _ = await PlayAsync(world, round);

        using var early = await VoteAsync(world, A.Admin, round, world.MemberIds[A.Player]);
        api.Clock.SetNow(created["endsAt"]!.GetValue<DateTimeOffset>().AddHours(24));
        using var late = await VoteAsync(world, A.Admin, round, world.MemberIds[A.Player]);
        var ballot = await BallotAsync(world, A.Admin, round);

        Assert.Equal("stats.mvp-voting-not-open", await RoundCalls.CodeAsync(early));
        Assert.Equal("stats.mvp-voting-closed", await RoundCalls.CodeAsync(late));
        Assert.Equal("closed", ballot["state"]!.GetValue<string>());
        Assert.Equal("closed", ballot["reason"]!.GetValue<string>());
    }

    /// <summary>A round with the vote on, one finished match of the Admin against the Player, and the close an hour after the start: the vote is open.</summary>
    private async Task<(GroupWorld World, string Round)> OpenRoundAsync(HttpClient client)
    {
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(settings: VotingOn));
        var round = created["roundId"]!.GetValue<string>();
        _ = await PlayAsync(world, round);
        StartRound(created);
        _ = await CloseAsync(world, A.Scorekeeper, round);
        var ballot = await BallotAsync(world, A.Admin, round);
        Assert.Equal("open", ballot["state"]!.GetValue<string>());
        return (world, round);
    }

    /// <summary>The API's clock an hour past the round's start: a round closes only once it began (ADR 0072, D1).</summary>
    private void StartRound(JsonObject created) =>
        api.Clock.SetNow(created["startsAt"]!.GetValue<DateTimeOffset>().AddHours(1));

    /// <summary>One finished match of the Admin against the Player; the phone goes on writing the round's only stream.</summary>
    private static async Task<CourtPhone> PlayAsync(GroupWorld world, string round)
    {
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]), phone.Point("a"), phone.ManualEnd("a")]);
        return phone;
    }

    private static async Task<JsonObject> CloseAsync(GroupWorld world, GroupActor actor, string round)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/close");
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        return JsonNode.Parse(body)!.AsObject();
    }

    private static string BallotPath(GroupWorld world, string round) => RoundCalls.RoundPath(world, round) + "/mvp-voting";

    private static string VotePath(GroupWorld world, string round) => BallotPath(world, round) + "/vote";

    private static Task<HttpResponseMessage> VoteAsync(GroupWorld world, GroupActor actor, string round, Guid candidate) =>
        world.SendAsync(actor, HttpMethod.Post, VotePath(world, round), $$"""{"candidateMemberId":"{{candidate}}"}""");

    private static async Task<HttpStatusCode> StatusAsync(Task<HttpResponseMessage> sending)
    {
        using var response = await sending;
        return response.StatusCode;
    }

    private static async Task<string> BallotTextAsync(GroupWorld world, GroupActor actor, string round)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, BallotPath(world, round));
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        return body;
    }

    private static async Task<JsonObject> BallotAsync(GroupWorld world, GroupActor actor, string round) =>
        JsonNode.Parse(await BallotTextAsync(world, actor, round))!.AsObject();

    private Task<long> VotesAsync(string round) =>
        CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM stats.mvp_votes WHERE round_id = @id", Guid.Parse(round));
}
