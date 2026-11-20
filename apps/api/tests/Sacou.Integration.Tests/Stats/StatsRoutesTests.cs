using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Matches;
using Sacou.Integration.Tests.RateLimiting;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Stats;

/// <summary>
/// 5.4.1, 5.4.5, 5.4.6 and 5.4.10 to 5.4.13 of E3.9 (part 4b): the two read routes of the Stats on the real API and a
/// real Postgres, who may read them, their limit, the export, and a sweep proving that no answer carries the hidden
/// rating.
/// </summary>
public sealed partial class StatsRoutesTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string MvpOn = """{"settings":{"schemaVersion":1,"mvp":{"enabled":true}}}""";
    private const string IndividualPointsOn = """{"settings":{"schemaVersion":1,"mvp":{"individualPoints":true}}}""";
    private const string IndividualPointsOff = """{"settings":{"schemaVersion":1,"mvp":{"individualPoints":false}}}""";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>
    /// 5.4.1: three matches (3–1 for a, 2–0 for b, 2–0 for a), every number worked out by hand: the summary of screen 12.
    /// The "Maior sequência" of each side is 1, a tie, so it is null.
    /// </summary>
    [Fact]
    public async Task ThreeMatches_AreTheSummaryWorkedOutByHand()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        _ = await SettingsCalls.PatchAsync(world, world.GroupPath, MvpOn);
        var (round, year) = await RoundAsync(world);
        var phone = CourtPhone.New();
        await PlayAsync(world, round, phone, "a", 3, 1);
        await PlayAsync(world, round, phone, "b", 0, 2);
        await PlayAsync(world, round, phone, "a", 2, 0);
        var admin = world.MemberIds[A.Admin];
        var player = world.MemberIds[A.Player];

        var summary = await StatsCalls.SummaryAsync(world, A.Player, round);

        Assert.Equal(
            ["roundId", "modality", "mvpFormulaVersion", "finishedMatches", "mvp", "sides", "players", "ranking"],
            summary.Select(pair => pair.Key));
        Assert.Equal("indoor-6x6", summary["modality"]!.GetValue<string>());
        Assert.Equal(1, summary["mvpFormulaVersion"]!.GetValue<int>());
        Assert.Equal(3, summary["finishedMatches"]!.GetValue<int>());
        Assert.Null(summary["ranking"]);
        Assert.Equal(
            $$"""{"kind":"player","memberIds":["{{admin}}"],"side":"a","plusMinus":2,"wins":2,"matchesPlayed":3,"longestWinStreak":1}""",
            summary["mvp"]!.ToJsonString());
        Assert.Equal("""{"mostWins":{"side":"a","wins":2},"longestStreak":null}""", summary["sides"]!.ToJsonString());
        Assert.Equal(
            $$"""[{"memberId":"{{admin}}","matchesPlayed":3,"wins":2,"losses":1,"undecided":0,"plusMinus":2,"longestWinStreak":1,"pointsByKind":{"attack":0,"block":0,"ace":0,"other":0},"mainSide":"a"},{"memberId":"{{player}}","matchesPlayed":3,"wins":1,"losses":2,"undecided":0,"plusMinus":-2,"longestWinStreak":1,"pointsByKind":{"attack":0,"block":0,"ace":0,"other":0},"mainSide":"b"}]""",
            summary["players"]!.ToJsonString());

        var season = await StatsCalls.MyStatsAsync(world, A.Admin, year);
        Assert.Equal(int.Parse(year, CultureInfo.InvariantCulture), season["year"]!.GetValue<int>());
        Assert.Equal(
            """{"matchesPlayed":3,"wins":2,"losses":1,"plusMinus":2,"longestWinStreak":1,"mvpCount":1,"rounds":1,"roundsHeld":1}""",
            season["total"]!.ToJsonString());
        var group = Assert.Single(season["groups"]!.AsArray(), item => item!["groupId"]!.GetValue<Guid>() == world.GroupId)!;
        Assert.Equal("Racha da matriz", group["groupName"]!.GetValue<string>());
        Assert.Equal("indoor-6x6", group["modality"]!.GetValue<string>());
        Assert.Equal(3, group["matchesPlayed"]!.GetValue<int>());
    }

    /// <summary>A round without a stream is 200 with nothing finished, and a year outside the seasons is a 400.</summary>
    [Fact]
    public async Task RoundWithoutStream_IsEmpty_AndABadYear_Is400()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, _) = await RoundAsync(world);

        var summary = await StatsCalls.SummaryAsync(world, A.Player, round);

        Assert.Equal(0, summary["finishedMatches"]!.GetValue<int>());
        Assert.Empty(summary["players"]!.AsArray());
        Assert.Null(summary["mvp"]);
        foreach (var year in new[] { "1999", "2101", "20x6", "-2026", "+2026" })
        {
            using var refused = await world.SendAsync(A.Player, HttpMethod.Get, $"{StatsCalls.MyStatsPath}?year={Uri.EscapeDataString(year)}");
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
            Assert.Equal("stats.year-invalid", await RoundCalls.CodeAsync(refused));
        }
    }

    /// <summary>5.4.5: a round canceled after it was played leaves the sums and the rating; back to scheduled, it returns.</summary>
    [Fact]
    public async Task CanceledRound_LeavesTheSumsAndTheRating_AndReturnsWhenScheduledAgain()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, year) = await RoundAsync(world);
        await PlayAsync(world, round, CourtPhone.New(), "a", 1, 0);
        Assert.Equal(1, (await StatsCalls.MyStatsAsync(world, A.Admin, year))["total"]!["matchesPlayed"]!.GetValue<int>());
        Assert.Equal(2, await RatingCountAsync(world.GroupId));

        using (var cancel = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel"))
        {
            Assert.True(cancel.IsSuccessStatusCode, await cancel.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }

        var canceled = await StatsCalls.MyStatsAsync(world, A.Admin, year);
        Assert.Equal(0, canceled["total"]!["matchesPlayed"]!.GetValue<int>());
        Assert.Equal(0, canceled["total"]!["roundsHeld"]!.GetValue<int>());
        Assert.Equal(0, await RatingCountAsync(world.GroupId));
        Assert.Equal(1, (await StatsCalls.SummaryAsync(world, A.Player, round))["finishedMatches"]!.GetValue<int>());

        await CourtCalls.ExecuteAsync(api.ConnectionString, "UPDATE sessions.rounds SET status = 'scheduled' WHERE id = @id", ("id", Guid.Parse(round)));

        Assert.Equal(1, (await StatsCalls.MyStatsAsync(world, A.Admin, year))["total"]!["matchesPlayed"]!.GetValue<int>());
        Assert.Equal(2, await RatingCountAsync(world.GroupId));
    }

    /// <summary>5.4.6 and pendência 104: with "Ponto individual" off, the next read zeroes <c>pointsByKind</c> (the facts hash changed); the balance stays.</summary>
    [Fact]
    public async Task IndividualPointsOff_ZeroesThePointsByKind_OnTheNextRead()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        _ = await SettingsCalls.PatchAsync(world, world.GroupPath, IndividualPointsOn);
        var (round, _) = await RoundAsync(world);
        var phone = CourtPhone.New();
        var admin = world.MemberIds[A.Admin];
        var started = phone.MatchStarted(admin, world.MemberIds[A.Player]);
        var point = phone.Point("a");
        var attributed = phone.Envelope(
            "PointAttributed", $$"""{"matchId":"{{phone.MatchId}}","pointEventId":"{{EventIdOf(point)}}","kind":"attack","author":"{{admin}}"}""");
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [started, point, attributed, phone.ManualEnd("a")]);

        var on = PlayerOf(await StatsCalls.SummaryAsync(world, A.Player, round), admin);
        Assert.Equal("""{"attack":1,"block":0,"ace":0,"other":0}""", on["pointsByKind"]!.ToJsonString());

        _ = await SettingsCalls.PatchAsync(world, world.GroupPath, IndividualPointsOff);

        var off = PlayerOf(await StatsCalls.SummaryAsync(world, A.Player, round), admin);
        Assert.Equal("""{"attack":0,"block":0,"ace":0,"other":0}""", off["pointsByKind"]!.ToJsonString());
        Assert.Equal(on["plusMinus"]!.GetValue<int>(), off["plusMinus"]!.GetValue<int>());
    }

    /// <summary>
    /// 5.4.10: any member reads the summary, the Jogador included; a non-member, a member who left, a round of another
    /// group and none are the same 404; no token is a 401. The season is only the caller's own.
    /// </summary>
    [Fact]
    public async Task Summary_IsForMembersOnly_AndTheSeasonIsOnlyTheCallers()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, year) = await RoundAsync(world);
        await PlayAsync(world, round, CourtPhone.New(), "a", 1, 0);
        var other = await GroupWorld.CreateAsync(api, client, "Outro racha");
        var (foreignRound, _) = await RoundAsync(other);

        foreach (var actor in new[] { A.Admin, A.CoAdmin, A.Scorekeeper, A.Player })
        {
            _ = await StatsCalls.SummaryAsync(world, actor, round);
        }

        using var missing = await world.SendAsync(A.Player, HttpMethod.Get, StatsCalls.SummaryPath(world, Guid.NewGuid().ToString()));
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(CourtCalls.RoundNotFound, await RoundCalls.CodeAsync(missing));
        using var foreign = await world.SendAsync(A.Player, HttpMethod.Get, StatsCalls.SummaryPath(world, foreignRound));
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        Assert.Equal(await CourtCalls.ProblemWithoutTraceAsync(missing), await CourtCalls.ProblemWithoutTraceAsync(foreign));
        foreach (var outsider in new[] { A.NonMember, A.LeftMember, A.RemovedMember })
        {
            using var refused = await world.SendAsync(outsider, HttpMethod.Get, StatsCalls.SummaryPath(world, round));
            Assert.Equal(HttpStatusCode.NotFound, refused.StatusCode);
        }

        using var anonymous = await world.SendAsync(A.Anonymous, HttpMethod.Get, StatsCalls.SummaryPath(world, round));
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        using var anonymousSeason = await world.SendAsync(A.Anonymous, HttpMethod.Get, StatsCalls.MyStatsPath);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymousSeason.StatusCode);

        var adminSeason = await StatsCalls.MyStatsAsync(world, A.Admin, year);
        var playerSeason = await StatsCalls.MyStatsAsync(world, A.Player, year);
        var scorekeeperSeason = await StatsCalls.MyStatsAsync(world, A.Scorekeeper, year);
        Assert.Equal(1, adminSeason["total"]!["wins"]!.GetValue<int>());
        Assert.Equal(1, playerSeason["total"]!["losses"]!.GetValue<int>());
        Assert.Equal(0, playerSeason["total"]!["wins"]!.GetValue<int>());
        Assert.Equal(0, scorekeeperSeason["total"]!["matchesPlayed"]!.GetValue<int>());
        Assert.Equal(1, scorekeeperSeason["total"]!["roundsHeld"]!.GetValue<int>());
    }

    /// <summary>5.4.11: both routes are under <c>court-sync</c>: the second call in a window of one is a 429.</summary>
    [Fact]
    public async Task BothRoutes_PastTheCourtSyncWindow_Are429()
    {
        await using var limited = await RateLimitingTests.StartAsync(database, RateLimitingTests.Limit("CourtSync", 1));
        using var client = limited.CreateClient();
        var world = await GroupWorld.CreateAsync(limited, client);
        var (round, _) = await RoundAsync(world);

        using (var first = await world.SendAsync(A.Player, HttpMethod.Get, StatsCalls.SummaryPath(world, round)))
        {
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        }

        using (var second = await world.SendAsync(A.Player, HttpMethod.Get, StatsCalls.SummaryPath(world, round)))
        {
            await RateLimitingTests.AssertRateLimitedAsync(second);
        }

        using (var first = await world.SendAsync(A.CoAdmin, HttpMethod.Get, StatsCalls.MyStatsPath))
        {
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        }

        using var refused = await world.SendAsync(A.CoAdmin, HttpMethod.Get, StatsCalls.MyStatsPath);
        await RateLimitingTests.AssertRateLimitedAsync(refused);
    }

    /// <summary>
    /// 5.4.12: the export has the <c>stats</c> section with the person's rounds and MVP, and never μ, σ nor the grade;
    /// after the account is deleted, the former member stays in the summary and in the rating of the others by member id.
    /// </summary>
    [Fact]
    public async Task Export_HasTheStatsWithoutTheRating_AndADeletedAccountStaysInTheOthersRating()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        _ = await SettingsCalls.PatchAsync(world, world.GroupPath, MvpOn);
        var (round, _) = await RoundAsync(world);
        await PlayAsync(world, round, CourtPhone.New(), "b", 0, 1);
        using (var graded = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.Player], "4.5"))
        {
            Assert.True(graded.IsSuccessStatusCode);
        }

        // The summary folds the pools (the export never does), so the export is checked against stored values.
        _ = await StatsCalls.SummaryAsync(world, A.Admin, round);
        Assert.True(await RatingCountAsync(world.GroupId) > 0);
        using var response = await world.SendAsync(A.Player, HttpMethod.Get, "/v1/me/export");
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = JsonNode.Parse(text)!.AsObject();
        var entry = Assert.Single(document["stats"]!.AsArray())!.AsObject();
        Assert.Equal(
            ["groupId", "roundId", "date", "counts", "matchesPlayed", "wins", "losses", "undecided", "plusMinus", "longestWinStreak", "pointsByKind", "wasMvp"],
            entry.Select(pair => pair.Key));
        Assert.Equal(Guid.Parse(round), entry["roundId"]!.GetValue<Guid>());
        Assert.True(entry["wasMvp"]!.GetValue<bool>());
        Assert.Equal(1, entry["wins"]!.GetValue<int>());
        await AssertNoRatingAsync(world.GroupId, text);
        Assert.DoesNotContain(document["stats"]!.AsArray().SelectMany(item => item!.AsObject()), pair => pair.Key.Contains("level", StringComparison.OrdinalIgnoreCase));

        using var deleted = await world.DeleteAccountAsync(A.Player);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        var summary = await StatsCalls.SummaryAsync(world, A.Admin, round);
        Assert.Contains(summary["players"]!.AsArray(), item => item!["memberId"]!.GetValue<Guid>() == world.MemberIds[A.Player]);
        Assert.Equal(1, await CourtCalls.CountAsync(
            api.ConnectionString, "SELECT count(*) FROM stats.member_ratings WHERE member_id = @id", world.MemberIds[A.Player]));
    }

    /// <summary>
    /// 5.4.13: every GET route of the API, with a full scenario (a played round, a graded member, ratings stored),
    /// answers without a stored μ or σ and without a key <c>mu</c>, <c>sigma</c>, <c>ordinal</c> or one with "rating".
    /// </summary>
    [Fact]
    public async Task EveryGetRoute_AnswersWithoutTheRating()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        _ = await SettingsCalls.PatchAsync(world, world.GroupPath, MvpOn);
        var (round, _) = await RoundAsync(world);
        var phone = CourtPhone.New();
        await PlayAsync(world, round, phone, "a", 2, 1);
        using (var graded = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.Player], "2.5"))
        {
            Assert.True(graded.IsSuccessStatusCode);
        }

        _ = await StatsCalls.SummaryAsync(world, A.Admin, round);
        Assert.Equal(2, await RatingCountAsync(world.GroupId));
        var values = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["groupId"] = world.GroupId.ToString(),
            ["roundId"] = round,
            ["courtSessionId"] = phone.CourtSessionId.ToString(),
            ["memberId"] = world.MemberIds[A.Player].ToString(),
        };

        var swept = 0;
        foreach (var path in GetRoutes(values))
        {
            foreach (var actor in new[] { A.Admin, A.Player })
            {
                using var response = await world.SendAsync(actor, HttpMethod.Get, path);
                var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
                await AssertNoRatingAsync(world.GroupId, body, path);
                swept++;
            }
        }

        Assert.True(swept >= 20, $"only {swept} answers were swept");
    }

    [GeneratedRegex("^(mu|sigma|ordinal)$|rating", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RatingKey();

    [GeneratedRegex(@"\{(\w+)(:[^}]*)?\}", RegexOptions.CultureInvariant)]
    private static partial Regex RouteParameter();

    /// <summary>The GET routes of the real API with every parameter the scenario has filled in; the others are skipped.</summary>
    private IEnumerable<string> GetRoutes(Dictionary<string, string> values)
    {
        var endpoints = api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods.Contains(HttpMethods.Get) == true);
        foreach (var endpoint in endpoints)
        {
            var pattern = "/" + endpoint.RoutePattern.RawText!.TrimStart('/');
            var names = RouteParameter().Matches(pattern).Select(match => match.Groups[1].Value).ToList();
            if (names.All(values.ContainsKey))
            {
                yield return RouteParameter().Replace(pattern, match => values[match.Groups[1].Value]);
            }
        }
    }

    /// <summary>No stored μ or σ of the group as text, and no key that names the rating, anywhere in <paramref name="body"/>.</summary>
    private async Task AssertNoRatingAsync(Guid groupId, string body, string where = "export")
    {
        foreach (var value in await StoredRatingTextsAsync(groupId))
        {
            Assert.False(body.Contains(value, StringComparison.Ordinal), $"{where} carries a stored rating value");
        }

        if (body.TrimStart().StartsWith('{') || body.TrimStart().StartsWith('['))
        {
            var keys = Keys(JsonNode.Parse(body)).Where(key => RatingKey().IsMatch(key)).ToList();
            Assert.True(keys.Count == 0, $"{where} has the keys {string.Join(',', keys)}");
        }
    }

    private static IEnumerable<string> Keys(JsonNode? node) => node switch
    {
        JsonObject item => item.SelectMany(pair => Keys(pair.Value).Prepend(pair.Key)),
        JsonArray items => items.SelectMany(Keys),
        _ => [],
    };

    /// <summary>μ and σ as the API would write a double (the shortest text that reads back the same value).</summary>
    private async Task<IReadOnlyList<string>> StoredRatingTextsAsync(Guid groupId)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var select = new NpgsqlCommand("SELECT mu, sigma FROM stats.member_ratings WHERE group_id = @id", connection);
        select.Parameters.AddWithValue("id", groupId);
        var texts = new List<string>();
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            foreach (var value in new[] { reader.GetDouble(0), reader.GetDouble(1) })
            {
                texts.Add(value.ToString("R", CultureInfo.InvariantCulture));
            }
        }

        Assert.NotEmpty(texts);
        return texts;
    }

    private Task<long> RatingCountAsync(Guid groupId) =>
        CourtCalls.CountAsync(api.ConnectionString, "SELECT count(*) FROM stats.member_ratings WHERE group_id = @id", groupId);

    /// <summary>A round three days ahead and the season of its date.</summary>
    private static async Task<(string RoundId, string Year)> RoundAsync(GroupWorld world)
    {
        var date = RoundCalls.FutureDate();
        var round = (await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(date)))["roundId"]!.GetValue<string>();
        return (round, date[..4]);
    }

    private static async Task PlayAsync(GroupWorld world, string round, CourtPhone phone, string winner, int pointsA, int pointsB)
    {
        string[] envelopes =
        [
            phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]),
            .. Enumerable.Range(0, pointsA).Select(_ => phone.Point("a")),
            .. Enumerable.Range(0, pointsB).Select(_ => phone.Point("b")),
            phone.ManualEnd(winner),
        ];
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, envelopes);
    }

    private static JsonObject PlayerOf(JsonObject summary, Guid memberId) =>
        summary["players"]!.AsArray().Single(item => item!["memberId"]!.GetValue<Guid>() == memberId)!.AsObject();

    private static Guid EventIdOf(string envelope) => JsonNode.Parse(envelope)!["eventId"]!.GetValue<Guid>();
}
