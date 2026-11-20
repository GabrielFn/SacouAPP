using System.Globalization;
using System.Text.Json.Nodes;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Matches;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Stats;

/// <summary>
/// 5.4 of E3.9 on the real API and a real Postgres. Since part 4b (condition 1 of the review of 4a) nothing is rebuilt
/// on the write of the court: the read rebuilds the stale round, and the pools once every counted round is fresh. A
/// correction recalculates everything; a late round gives the same rating as from scratch; the seed is the current
/// level. The rating is read only straight from the table, as the internal reader of a test (no route returns it).
/// </summary>
public sealed class StatsProjectionTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string RoundRebuilt = "Round projection rebuilt.";

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    /// <summary>
    /// Condition 1 of part 4a: the batch that closes the match replays nothing and writes no projection; the first
    /// read rebuilds the round, the member rows and both pools; the second read replays nothing.
    /// </summary>
    [Fact]
    public async Task ClosingBatch_ReplaysNothing_AndTheReadRebuildsTheRoundAndThePools()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var logsBefore = api.Logs.Count;

        _ = await PlayAsync(world, round, phone, winner: "a", pointsA: 3, pointsB: 1);

        Assert.Equal(0, await CountAsync("SELECT count(*) FROM stats.round_projections WHERE round_id = @id", Guid.Parse(round)));
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM stats.rating_pools WHERE group_id = @id", world.GroupId));
        Assert.DoesNotContain(api.Logs.EntriesSince(logsBefore), entry => entry.Contains(RoundRebuilt, StringComparison.Ordinal));

        _ = await StatsCalls.SummaryAsync(world, A.Player, round);

        Assert.Single(api.Logs.EntriesSince(logsBefore), entry => entry.Contains(RoundRebuilt, StringComparison.Ordinal));
        Assert.Equal(1, await CountAsync(
            "SELECT count(*) FROM stats.round_projections WHERE round_id = @id AND event_count = 6 AND finished_matches = 1 AND counts AND projection_version = 1 AND summary->'finishedMatches'->0->>'winner' = 'a'",
            Guid.Parse(round)));
        Assert.Equal("w", await MemberResultsAsync(round, world.MemberIds[A.Admin]));
        Assert.Equal("l", await MemberResultsAsync(round, world.MemberIds[A.Player]));
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM stats.rating_pools WHERE group_id = @id", world.GroupId));
        var ratings = await RatingsAsync(world.GroupId);
        Assert.Equal(2, ratings.Count);
        Assert.All(ratings.Values, rating => Assert.Equal(1, rating.MatchesRated));
        Assert.True(ratings[world.MemberIds[A.Admin]].Mu > ratings[world.MemberIds[A.Player]].Mu);

        _ = await StatsCalls.SummaryAsync(world, A.Player, round);
        Assert.Single(api.Logs.EntriesSince(logsBefore), entry => entry.Contains(RoundRebuilt, StringComparison.Ordinal));
    }

    /// <summary>5.4.2: a revert to before the <c>MatchEnded</c>, then another end, changes the result and the rating on the next read.</summary>
    [Fact]
    public async Task RevertBeforeTheEnd_RecalculatesTheRound_AndTheRating()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var started = phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]);
        var firstPoint = phone.Point("a");
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [started, firstPoint, phone.Point("a"), phone.ManualEnd("a")]);
        _ = await StatsCalls.SummaryAsync(world, A.Player, round);
        Assert.Equal("w", await MemberResultsAsync(round, world.MemberIds[A.Admin]));

        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone,
            [phone.RevertedTo(EventIdOf(firstPoint)), phone.Point("b"), phone.Point("b"), phone.ManualEnd("b")]);
        var summary = await StatsCalls.SummaryAsync(world, A.Player, round);

        Assert.Equal("l", await MemberResultsAsync(round, world.MemberIds[A.Admin]));
        Assert.Equal("w", await MemberResultsAsync(round, world.MemberIds[A.Player]));
        Assert.Equal(1, summary["finishedMatches"]!.GetValue<int>());
        var ratings = await RatingsAsync(world.GroupId);
        Assert.True(ratings[world.MemberIds[A.Player]].Mu > ratings[world.MemberIds[A.Admin]].Mu);
        Assert.All(ratings.Values, rating => Assert.Equal(1, rating.MatchesRated));
    }

    /// <summary>
    /// 5.4.3 and 5.4.7: the later round synced first (a phone offline) folds in play order; a read with another round
    /// still stale defers the pools; deleting every projection of the group and reading again gives the very same
    /// rows and answers, byte for byte.
    /// </summary>
    [Fact]
    public async Task LateRound_FoldsInPlayOrder_AndFromScratchEqualsIncremental()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var earlier = await RoundOnAsync(world, days: 3);
        var later = await RoundOnAsync(world, days: 5);
        _ = await PlayAsync(world, later, CourtPhone.New(), winner: "a", pointsA: 2, pointsB: 0);
        _ = await StatsCalls.SummaryAsync(world, A.Player, later);
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM stats.rating_pools WHERE group_id = @id", world.GroupId));

        _ = await PlayAsync(world, earlier, CourtPhone.New(), winner: "b", pointsA: 0, pointsB: 2);
        var poolsBefore = await SnapshotAsync(world.GroupId);
        _ = await StatsCalls.SummaryAsync(world, A.Player, later);
        Assert.Equal(poolsBefore.Ratings, (await SnapshotAsync(world.GroupId)).Ratings);
        var earlierAnswer = (await StatsCalls.SummaryAsync(world, A.Player, earlier)).ToJsonString();
        var laterAnswer = (await StatsCalls.SummaryAsync(world, A.Player, later)).ToJsonString();
        var incremental = await SnapshotAsync(world.GroupId);
        Assert.NotEqual(poolsBefore.Ratings, incremental.Ratings);
        var season = (await StatsCalls.MyStatsAsync(world, A.Admin)).ToJsonString();

        await DeleteProjectionsAsync(world.GroupId);
        var fromScratchSeason = (await StatsCalls.MyStatsAsync(world, A.Admin)).ToJsonString();
        var fromScratch = await SnapshotAsync(world.GroupId);

        Assert.Equal(incremental.Ratings, fromScratch.Ratings);
        Assert.Equal(incremental.Summaries[later], fromScratch.Summaries[later]);
        Assert.Equal(incremental.Summaries[earlier], fromScratch.Summaries[earlier]);
        Assert.Equal(season, fromScratchSeason);
        Assert.Equal(earlierAnswer, (await StatsCalls.SummaryAsync(world, A.Player, earlier)).ToJsonString());
        Assert.Equal(laterAnswer, (await StatsCalls.SummaryAsync(world, A.Player, later)).ToJsonString());
        var ratings = await RatingsAsync(world.GroupId);
        Assert.All(ratings.Values, rating => Assert.Equal(2, rating.MatchesRated));
    }

    /// <summary>5.4.4 and question 98: the admin's new grade seeds the pool again on the next read, with a low σ; no answer changes.</summary>
    [Fact]
    public async Task AdminGrade_Changed_SeedsThePoolAgain_OnTheNextRead()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        _ = await PlayAsync(world, round, CourtPhone.New(), winner: "a", pointsA: 1, pointsB: 0);
        var answer = (await StatsCalls.SummaryAsync(world, A.Player, round)).ToJsonString();
        var before = (await RatingsAsync(world.GroupId))[world.MemberIds[A.Player]];

        using var graded = await LevelCalls.SetAsync(world, A.Admin, world.MemberIds[A.Player], "4.5");
        Assert.True(graded.IsSuccessStatusCode, await graded.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        Assert.Equal(answer, (await StatsCalls.SummaryAsync(world, A.Player, round)).ToJsonString());
        var after = (await RatingsAsync(world.GroupId))[world.MemberIds[A.Player]];
        Assert.Equal((45, "admin"), (after.SeedTenths, after.SeedSource));
        Assert.NotEqual(before.Mu, after.Mu);
    }

    /// <summary>5.4.9: a listener that throws after the commit leaves the write as it was and logs only the stream and the type; the read rebuilds.</summary>
    [Fact]
    public async Task FailingListener_NeverFailsTheWrite_AndTheReadRebuilds()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        var logsBefore = api.Logs.Count;
        api.BeforeCourtStreamChanged = () => throw new InvalidOperationException("listener down");
        try
        {
            _ = await PlayAsync(world, round, phone, winner: "a", pointsA: 1, pointsB: 0);
        }
        finally
        {
            api.BeforeCourtStreamChanged = null;
        }

        Assert.Contains(api.Logs.EntriesSince(logsBefore), entry =>
            entry.Contains("Court projections not refreshed", StringComparison.Ordinal)
            && entry.Contains(phone.CourtSessionId.ToString(), StringComparison.Ordinal)
            && entry.Contains(nameof(InvalidOperationException), StringComparison.Ordinal));
        Assert.DoesNotContain(api.Logs.EntriesSince(logsBefore), entry => entry.Contains("listener down", StringComparison.Ordinal));

        var summary = await StatsCalls.SummaryAsync(world, A.Player, round);

        Assert.Equal(1, summary["finishedMatches"]!.GetValue<int>());
        Assert.Equal("w", await MemberResultsAsync(round, world.MemberIds[A.Admin]));
    }

    /// <summary>
    /// 5.4.8 (condition 4 of the review of 4a): four reads of the same stale round at once. Every call is a 200 with
    /// the same answer, and the round keeps one row, one set of member rows and one row per member of the pool.
    /// </summary>
    [Fact]
    public async Task ConcurrentReadsOfAStaleRound_LeaveOneRow_AndNoKeyError()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        _ = await PlayAsync(world, round, CourtPhone.New(), winner: "a", pointsA: 3, pointsB: 1);

        var answers = await Task.WhenAll(Enumerable.Range(0, 4).Select(async index =>
            (await StatsCalls.SummaryAsync(world, index % 2 == 0 ? A.Player : A.Admin, round)).ToJsonString()));

        Assert.Single(answers.Distinct(StringComparer.Ordinal));
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM stats.round_projections WHERE round_id = @id AND finished_matches = 1", Guid.Parse(round)));
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM stats.round_member_stats WHERE round_id = @id", Guid.Parse(round)));
        Assert.Equal(2, (await RatingsAsync(world.GroupId)).Count);
        Assert.Equal(2, await CountAsync("SELECT count(*) FROM stats.rating_pools WHERE group_id = @id", world.GroupId));
    }

    /// <summary>
    /// Condition 2 of the review of 4a: an older rebuild that lands after a newer one (written here by hand: an old key
    /// of the round, an old hash of the pool and other ratings) is never served; the next read redoes both.
    /// </summary>
    [Fact]
    public async Task OlderWrite_AfterANewerOne_IsRedoneByTheNextRead()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await CourtCalls.RoundAsync(world);
        _ = await PlayAsync(world, round, CourtPhone.New(), winner: "a", pointsA: 1, pointsB: 0);
        var answer = (await StatsCalls.SummaryAsync(world, A.Player, round)).ToJsonString();
        var fresh = await SnapshotAsync(world.GroupId);

        await CourtCalls.ExecuteAsync(api.ConnectionString,
            "UPDATE stats.round_projections SET facts_hash = 'stale', summary = '{}'::jsonb WHERE round_id = @id", ("id", Guid.Parse(round)));
        await CourtCalls.ExecuteAsync(api.ConnectionString, "UPDATE stats.rating_pools SET inputs_hash = 'stale' WHERE group_id = @id", ("id", world.GroupId));
        await CourtCalls.ExecuteAsync(api.ConnectionString, "UPDATE stats.member_ratings SET mu = 1, sigma = 1 WHERE group_id = @id", ("id", world.GroupId));

        Assert.Equal(answer, (await StatsCalls.SummaryAsync(world, A.Player, round)).ToJsonString());
        var redone = await SnapshotAsync(world.GroupId);
        Assert.Equal(fresh.Ratings, redone.Ratings);
        Assert.Equal(fresh.Summaries[round], redone.Summaries[round]);
    }

    private static async Task<(long LastSequence, int Stored)> PlayAsync(
        GroupWorld world, string round, CourtPhone phone, string winner, int pointsA, int pointsB)
    {
        string[] envelopes =
        [
            phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player]),
            .. Enumerable.Range(0, pointsA).Select(_ => phone.Point("a")),
            .. Enumerable.Range(0, pointsB).Select(_ => phone.Point("b")),
            phone.ManualEnd(winner),
        ];
        return await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, envelopes);
    }

    private static async Task<string> RoundOnAsync(GroupWorld world, int days) =>
        (await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(RoundCalls.FutureDate(days))))["roundId"]!.GetValue<string>();

    private static Guid EventIdOf(string envelope) => JsonNode.Parse(envelope)!["eventId"]!.GetValue<Guid>();

    private Task<long> CountAsync(string sql, Guid id) => CourtCalls.CountAsync(api.ConnectionString, sql, id);

    private async Task<string?> MemberResultsAsync(string round, Guid memberId)
    {
        await using var connection = await OpenAsync();
        await using var select = new NpgsqlCommand("SELECT results FROM stats.round_member_stats WHERE round_id = @round AND member_id = @member", connection);
        select.Parameters.AddWithValue("round", Guid.Parse(round));
        select.Parameters.AddWithValue("member", memberId);
        return (string?)await select.ExecuteScalarAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Dictionary<Guid, StoredRating>> RatingsAsync(Guid groupId)
    {
        await using var connection = await OpenAsync();
        await using var select = new NpgsqlCommand(
            "SELECT member_id, mu, sigma, seed_tenths, seed_source, matches_rated FROM stats.member_ratings WHERE group_id = @id AND pool = 'indoor'", connection);
        select.Parameters.AddWithValue("id", groupId);
        var ratings = new Dictionary<Guid, StoredRating>();
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            ratings[reader.GetGuid(0)] = new StoredRating(reader.GetDouble(1), reader.GetDouble(2), reader.GetInt32(3), reader.GetString(4), reader.GetInt32(5));
        }

        return ratings;
    }

    /// <summary>Every stored row of the group as text: the ratings by member and pool, and each summary by round.</summary>
    private async Task<StatsSnapshot> SnapshotAsync(Guid groupId)
    {
        await using var connection = await OpenAsync();
        await using var ratings = new NpgsqlCommand(
            "SELECT coalesce(string_agg(concat_ws(':', pool, member_id, mu::text, sigma::text, seed_tenths, seed_source, matches_rated), ',' ORDER BY pool, member_id), '') FROM stats.member_ratings WHERE group_id = @id",
            connection);
        ratings.Parameters.AddWithValue("id", groupId);
        var ratingText = (string)(await ratings.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
        await using var summaries = new NpgsqlCommand("SELECT round_id, summary::text FROM stats.round_projections WHERE group_id = @id", connection);
        summaries.Parameters.AddWithValue("id", groupId);
        var byRound = new Dictionary<string, string>(StringComparer.Ordinal);
        await using var reader = await summaries.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            byRound[reader.GetGuid(0).ToString("D", CultureInfo.InvariantCulture)] = reader.GetString(1);
        }

        return new StatsSnapshot(ratingText, byRound);
    }

    private async Task DeleteProjectionsAsync(Guid groupId)
    {
        await CourtCalls.ExecuteAsync(api.ConnectionString, "DELETE FROM stats.member_ratings WHERE group_id = @id", ("id", groupId));
        await CourtCalls.ExecuteAsync(api.ConnectionString, "DELETE FROM stats.rating_pools WHERE group_id = @id", ("id", groupId));
        await CourtCalls.ExecuteAsync(api.ConnectionString, "DELETE FROM stats.round_member_stats WHERE group_id = @id", ("id", groupId));
        await CourtCalls.ExecuteAsync(api.ConnectionString, "DELETE FROM stats.round_projections WHERE group_id = @id", ("id", groupId));
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM stats.round_projections WHERE group_id = @id", groupId));
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }

    private sealed record StoredRating(double Mu, double Sigma, int SeedTenths, string SeedSource, int MatchesRated);

    private sealed record StatsSnapshot(string Ratings, IReadOnlyDictionary<string, string> Summaries);
}
