using System.Net;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>F and P of E3.4: the story of a round end to end, and what the migration really created.</summary>
public sealed class RoundFlowTests(IntegrationDatabase database) : IAsyncLifetime
{
    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Mensalista_IsConfirmedOnCreation_AndTheWaitlistPromotesOnGivingUp()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 2, regulars: true);
        var regular = await world.AddPersonAsync(memberType: "regular");
        var firstPlayer = await world.AddPersonAsync();
        var secondPlayer = await world.AddPersonAsync();
        var thirdPlayer = await world.AddPersonAsync();

        var created = await RoundCalls.CreateAsync(world);
        var round = created["roundId"]!.GetValue<string>();
        Assert.Equal(1, created["goingCount"]!.GetValue<int>());
        Assert.Equal("regular", created["going"]![0]!["source"]!.GetValue<string>());

        var first = await RoundCalls.RespondAsync(world, firstPlayer.Subject, round, going: true);
        var second = await RoundCalls.RespondAsync(world, secondPlayer.Subject, round, going: true);
        var third = await RoundCalls.RespondAsync(world, thirdPlayer.Subject, round, going: true);
        Assert.Equal("going", first.Body!["status"]!.GetValue<string>());
        Assert.Equal("waitlisted", second.Body!["status"]!.GetValue<string>());
        Assert.Equal(2, third.Body!["position"]!.GetValue<int>());

        Assert.Equal(HttpStatusCode.OK, await RoundCalls.SetAsync(world, round, regular.MemberId, going: false));
        var detail = await RoundCalls.GetAsync(world, round);
        Assert.Equal(2, detail["goingCount"]!.GetValue<int>());
        Assert.Equal(1, detail["waitlistCount"]!.GetValue<int>());
        Assert.Contains(detail["going"]!.AsArray(), entry => entry!["promoted"]!.GetValue<bool>());
    }

    [Fact]
    public async Task FullRoundWithoutWaitlist_IsRoundFull_AndACanceledRoundIsClosed()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 2, waitlist: false);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        _ = await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true);
        _ = await RoundCalls.RespondAsync(world, world.Subjects[A.Scorekeeper], round, going: true);

        var refused = await RoundCalls.RespondAsync(world, world.Subjects[A.CoAdmin], round, going: true);
        using var cancel = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel");
        var closed = await RoundCalls.RespondAsync(world, world.Subjects[A.CoAdmin], round, going: true);

        Assert.Equal("sessions.round-full", refused.Code);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);
        Assert.Equal("sessions.round-closed", closed.Code);
        Assert.Equal(2, (await RoundCalls.RowsAsync(api.ConnectionString, round)).Count);
    }

    [Fact]
    public async Task Series_MakesTheNextRoundOnRead_AndStopsWhenStopped()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(repeat: true));
        var series = created["seriesId"]!.GetValue<string>();
        await using (var connection = await MemberRows.OpenAsync(api.ConnectionString))
        {
            await using var past = new NpgsqlCommand(
                "UPDATE sessions.rounds SET starts_at = starts_at - interval '30 days', local_date = local_date - 30 WHERE id = @id", connection);
            past.Parameters.AddWithValue("id", Guid.Parse(created["roundId"]!.GetValue<string>()));
            await past.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        using var listed = await world.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundsPath(world));
        var upcoming = (await RoundCalls.JsonAsyncArray(listed)).Count(round => round!["status"]!.GetValue<string>() == "scheduled");
        using var stop = await world.SendAsync(A.Admin, HttpMethod.Post, $"{world.GroupPath}/series/{series}/stop");
        using var again = await world.SendAsync(A.Admin, HttpMethod.Post, $"{world.GroupPath}/series/{series}/stop");

        Assert.Equal(1, upcoming);
        Assert.Equal(HttpStatusCode.NoContent, stop.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
    }

    /// <summary>E4.6: the list tells which rounds belong to a series, so the app does not offer a second weekly series.</summary>
    [Fact]
    public async Task List_CarriesTheSeriesIdOfEachRound_AndNullForAOneOffRound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var weekly = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(repeat: true));
        var oneOff = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(date: RoundCalls.FutureDate(5)));

        using var listed = await world.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundsPath(world));
        var rounds = (await RoundCalls.JsonAsyncArray(listed)).Select(round => round!.AsObject()).ToList();

        Assert.Equal(weekly["seriesId"]!.GetValue<string>(), rounds.Single(round => round["roundId"]!.GetValue<string>() == weekly["roundId"]!.GetValue<string>())["seriesId"]!.GetValue<string>());
        Assert.Null(rounds.Single(round => round["roundId"]!.GetValue<string>() == oneOff["roundId"]!.GetValue<string>())["seriesId"]);
    }

    /// <summary>The list carries the real end of each round (ADR 0072, D1), so the app closes the summary card 24 h after it.</summary>
    [Fact]
    public async Task List_CarriesTheEndOfEachRound()
    {
        const int AutoEndHours = 6;
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(date: RoundCalls.FutureDate(5)));

        using var listed = await world.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundsPath(world));
        var round = (await RoundCalls.JsonAsyncArray(listed)).Single(item => item!["roundId"]!.GetValue<string>() == created["roundId"]!.GetValue<string>())!;

        Assert.Equal(created["startsAt"]!.GetValue<DateTimeOffset>().AddHours(AutoEndHours), round["endsAt"]!.GetValue<DateTimeOffset>());
    }

    /// <summary>F1: the whole week of a racha, on a clock the test moves: mensalistas in, the drop-in window, the waitlist, and the next round.</summary>
    [Fact]
    public async Task WeeklyRacha_RunsFromTheMensalistasToTheNextRound()
    {
        const int WindowHours = 24;
        const int InsideTheWindowHours = 23;
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        await RoundCalls.ConfigureAttendanceAsync(world, capacity: 4, regulars: true, dropInOpensHoursBefore: WindowHours);
        var firstRegular = await world.AddPersonAsync(memberType: "regular");
        _ = await world.AddPersonAsync(memberType: "regular");
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(repeat: true));
        var round = created["roundId"]!.GetValue<string>();
        var startsAt = created["startsAt"]!.GetValue<DateTimeOffset>();
        Assert.Equal(2, created["goingCount"]!.GetValue<int>());

        var closed = await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true);
        api.Clock.SetNow(startsAt.AddHours(-InsideTheWindowHours));
        var first = await RoundCalls.RespondAsync(world, world.Subjects[A.Player], round, going: true);
        var second = await RoundCalls.RespondAsync(world, world.Subjects[A.Scorekeeper], round, going: true);
        var third = await RoundCalls.RespondAsync(world, world.Subjects[A.CoAdmin], round, going: true);

        Assert.Equal("sessions.drop-in-window-closed", closed.Code);
        Assert.Equal(["going", "going", "waitlisted"], new[] { first, second, third }.Select(answer => answer.Body!["status"]!.GetValue<string>()));
        Assert.Equal(1, third.Body!["position"]!.GetValue<int>());

        var gaveUp = await RoundCalls.RespondAsync(world, firstRegular.Subject, round, going: false);
        var afterGivingUp = await RoundCalls.GetAsync(world, round);
        Assert.Equal(HttpStatusCode.OK, gaveUp.Status);
        Assert.Equal(4, afterGivingUp["goingCount"]!.GetValue<int>());
        Assert.Equal(0, afterGivingUp["waitlistCount"]!.GetValue<int>());
        Assert.Contains(afterGivingUp["going"]!.AsArray(), entry => entry!["memberId"]!.GetValue<Guid>() == world.MemberIds[A.CoAdmin] && entry["promoted"]!.GetValue<bool>());

        api.Clock.SetNow(startsAt.AddHours(1));
        var next = await NextScheduledAsync(world, after: startsAt);
        Assert.Equal(2, next["goingCount"]!.GetValue<int>());
        Assert.Equal(WeekLater(created), next["localDate"]!.GetValue<string>());
    }

    /// <summary>F2: cancelling the upcoming occurrence makes the next week's on the next read.</summary>
    [Fact]
    public async Task CancelingTheUpcomingOccurrence_MakesTheOneOfTheFollowingWeek()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(repeat: true));
        var round = created["roundId"]!.GetValue<string>();

        using var cancel = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundPath(world, round) + "/cancel");
        var next = await NextScheduledAsync(world, after: created["startsAt"]!.GetValue<DateTimeOffset>());

        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);
        Assert.Equal(WeekLater(created), next["localDate"]!.GetValue<string>());
        Assert.Equal(created["seriesId"]!.GetValue<string>(), (await RoundCalls.GetAsync(world, next["roundId"]!.GetValue<string>()))["seriesId"]!.GetValue<string>());
    }

    /// <summary>An edit that moves a round of a series onto a date the series already has is a 409 with its own code, and the round stays as it was.</summary>
    [Fact]
    public async Task MovingASeriesRoundToATakenDate_Is409_AndNothingChanges()
    {
        const int DaysInWeek = 7;
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var created = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(repeat: true));
        var round = created["roundId"]!.GetValue<string>();
        await using (var connection = await MemberRows.OpenAsync(api.ConnectionString))
        {
            await ExecuteAsync(connection,
                "INSERT INTO sessions.rounds (id, group_id, series_id, local_date, local_time, time_zone, starts_at, venue, status, next_sequence, created_at) " +
                $"SELECT gen_random_uuid(), group_id, series_id, local_date + {DaysInWeek}, local_time, time_zone, starts_at + interval '{DaysInWeek} days', venue, status, next_sequence, created_at " +
                $"FROM sessions.rounds WHERE id = '{round}'");
        }

        using var response = await world.SendAsync(
            A.Admin, HttpMethod.Patch, RoundCalls.RoundPath(world, round), $$"""{"localDate":"{{WeekLater(created)}}"}""");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("sessions.round-date-taken", await RoundCalls.CodeAsync(response));
        Assert.Equal(created["localDate"]!.GetValue<string>(), (await RoundCalls.GetAsync(world, round))["localDate"]!.GetValue<string>());
    }

    private static string WeekLater(System.Text.Json.Nodes.JsonObject round) =>
        DateOnly.ParseExact(round["localDate"]!.GetValue<string>(), "yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)
            .AddDays(7).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

    /// <summary>The list read makes the series' next round; this is the scheduled round that starts after <paramref name="after"/>.</summary>
    private static async Task<System.Text.Json.Nodes.JsonObject> NextScheduledAsync(GroupWorld world, DateTimeOffset after)
    {
        using var listed = await world.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundsPath(world));
        var next = (await RoundCalls.JsonAsyncArray(listed))
            .Select(entry => entry!.AsObject())
            .Single(entry => entry["status"]!.GetValue<string>() == "scheduled" && entry["startsAt"]!.GetValue<DateTimeOffset>() > after);
        return next;
    }

    [Fact]
    public async Task Create_RefusesThePastAndTheTwentyFirstRound()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        using var past = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundsPath(world), RoundCalls.CreateBody("2020-01-01"));
        for (var index = 0; index < 20; index++)
        {
            _ = await RoundCalls.CreateAsync(world, RoundCalls.CreateBody(RoundCalls.FutureDate(2 + index)));
        }

        using var twentyFirst = await world.SendAsync(A.Admin, HttpMethod.Post, RoundCalls.RoundsPath(world), RoundCalls.CreateBody(RoundCalls.FutureDate(40)));

        Assert.Equal("sessions.round-invalid", await RoundCalls.CodeAsync(past));
        Assert.Equal("sessions.round-limit", await RoundCalls.CodeAsync(twentyFirst));
    }

    /// <summary>P1 and P4: the tables, the unique indexes and the CHECKs exist and refuse a hand-made bad row.</summary>
    [Fact]
    public async Task Migration_CreatesTheTablesAndTheirGuards()
    {
        await using var connection = await MemberRows.OpenAsync(api.ConnectionString);
        var tables = await ScalarAsync(connection, "SELECT string_agg(table_name, ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema = 'sessions' AND table_name <> '__ef_migrations_history'");
        var indexes = await ScalarAsync(connection, "SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'sessions'");
        Assert.Equal("attendances,outbox_messages,round_series,round_teams,rounds", tables);
        Assert.Contains("ux_rounds_series_date", indexes, StringComparison.Ordinal);
        Assert.Contains("pk_round_teams", indexes, StringComparison.Ordinal);
        Assert.Contains("ix_round_teams_member", indexes, StringComparison.Ordinal);
        Assert.Contains("ux_attendances_round_sequence", indexes, StringComparison.Ordinal);
        Assert.Contains("pk_attendances", indexes, StringComparison.Ordinal);
        Assert.Contains("ix_attendances_member", indexes, StringComparison.Ordinal);
        Assert.Equal("1", await ScalarAsync(connection, "SELECT count(*)::text FROM sessions.\"__ef_migrations_history\" WHERE \"MigrationId\" LIKE '%CreateRounds'"));

        await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(connection,
            "INSERT INTO sessions.rounds (id, group_id, local_date, local_time, time_zone, starts_at, venue, status, next_sequence, created_at) " +
            "VALUES (gen_random_uuid(), gen_random_uuid(), '2030-01-01', '20:00', 'Europe/Paris', now(), '', 'scheduled', 1, now())"));
        await Assert.ThrowsAsync<PostgresException>(() => ExecuteAsync(connection,
            "INSERT INTO sessions.rounds (id, group_id, local_date, local_time, time_zone, starts_at, venue, settings_layer, status, next_sequence, created_at) " +
            "VALUES (gen_random_uuid(), gen_random_uuid(), '2030-01-01', '20:00', 'America/Sao_Paulo', now(), '', '[1]', 'scheduled', 1, now())"));
    }

    /// <summary>P5: a damaged stored layer is a generic 500 and the log carries the round id, never the layer.</summary>
    [Fact]
    public async Task DamagedStoredLayer_Is500_AndTheLogHasNoContent()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();
        await using (var connection = await MemberRows.OpenAsync(api.ConnectionString))
        {
            await ExecuteAsync(connection, $"UPDATE sessions.rounds SET settings_layer = '{{\"scoring\":{{\"bestOf\":\"SEGREDO-NA-CAMADA\"}}}}' WHERE id = '{round}'");
        }

        using var response = await world.SendAsync(A.Admin, HttpMethod.Get, RoundCalls.RoundPath(world, round));

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain("SEGREDO-NA-CAMADA", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
        Assert.DoesNotContain(api.Logs.Entries, entry => entry.Contains("SEGREDO-NA-CAMADA", StringComparison.Ordinal));
    }

    private static async Task<string?> ScalarAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        return (string?)await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);
    }

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }
}
