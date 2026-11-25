using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Shared.Metrics;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Integration.Tests.Operations;

/// <summary>
/// Criteria 17 to 23 of E7.2 on a real Postgres: the rounds by what happened to them, the active groups, and the gate's
/// answers of the rounds held, by group and the week of São Paulo, as the rows hold them now.
/// </summary>
public sealed class SessionsMetricsTests(IntegrationDatabase database) : MetricsDatabase(database)
{
    private static readonly Guid Quinta = Guid.Parse("0198a7c0-0000-7000-8000-0000000000a1");
    private static readonly Guid Sabado = Guid.Parse("0198a7c0-0000-7000-8000-0000000000a2");

    /// <summary>Tuesday 24/11/2026, 15:00 in São Paulo; the weeks from Monday 05/10.</summary>
    private static readonly DateTimeOffset Now = new(2026, 11, 24, 18, 0, 0, TimeSpan.Zero);

    private static readonly MetricsPeriod Period = new("America/Sao_Paulo", Now, new DateTimeOffset(2026, 10, 5, 3, 0, 0, TimeSpan.Zero));

    private int sequence;

    [Fact]
    public async Task TheExampleOfTheGate_CountsOnlyTheHeldRounds_WithoutTheMensalistas()
    {
        // Thursday 19/11, 20:00 in São Paulo: 3 self/web, 1 self/app, 2 admin, 4 regular, and who did not go.
        var held = await AddRoundAsync(Quinta, new DateTimeOffset(2026, 11, 19, 23, 0, 0, TimeSpan.Zero));
        await AnswerAsync(held, "going", "self", "web", 3);
        await AnswerAsync(held, "going", "self", "app", 1);
        await AnswerAsync(held, "going", "admin", "app", 2);
        await AnswerAsync(held, "going", "regular", "app", 4);
        await AnswerAsync(held, "not_going", "self", "web", 2);
        await AnswerAsync(held, "waitlisted", "self", "web", 1);
        // A canceled round and one not started yet: out of the gate, whatever their answers.
        var canceled = await AddRoundAsync(Quinta, new DateTimeOffset(2026, 11, 18, 23, 0, 0, TimeSpan.Zero), status: "canceled");
        await AnswerAsync(canceled, "going", "self", "web", 10);
        var later = await AddRoundAsync(Quinta, Now.AddHours(1));
        await AnswerAsync(later, "going", "self", "web", 10);

        var metrics = await CountAsync();

        var week = Assert.Single(metrics.HeldByGroupWeek);
        Assert.Equal(new HeldWeek(Quinta, new DateOnly(2026, 11, 16), Rounds: 1, Confirmed: 6, SelfAnswered: 4, ByLink: 3), week);
    }

    [Fact]
    public async Task APromotedAnswerConfirms_AndTheRowsChannelIsTheLastAnswer()
    {
        var held = await AddRoundAsync(Sabado, new DateTimeOffset(2026, 11, 21, 15, 0, 0, TimeSpan.Zero));
        await AnswerAsync(held, "promoted", "self", "web", 1);
        // Answered by the link, then changed in the app: the row says app (ADR 0070, D3).
        await AnswerAsync(held, "going", "self", "app", 1);

        var week = Assert.Single((await CountAsync()).HeldByGroupWeek);

        Assert.Equal(2, week.Confirmed);
        Assert.Equal(2, week.SelfAnswered);
        Assert.Equal(1, week.ByLink);
    }

    [Fact]
    public async Task ARoundOnSundayNightInSaoPaulo_IsInTheWeekOfThatSunday_AndARoundWithoutAnswersStillCounts()
    {
        // Sunday 22/11 23:30 in São Paulo is Monday 23/11 02:30 UTC.
        await AddRoundAsync(Quinta, new DateTimeOffset(2026, 11, 23, 2, 30, 0, TimeSpan.Zero));
        await AddRoundAsync(Quinta, new DateTimeOffset(2026, 11, 23, 3, 30, 0, TimeSpan.Zero));

        var weeks = (await CountAsync()).HeldByGroupWeek.OrderBy(week => week.WeekStart).ToList();

        Assert.Equal([new DateOnly(2026, 11, 16), new DateOnly(2026, 11, 23)], weeks.Select(week => week.WeekStart));
        Assert.All(weeks, week => Assert.Equal((1, 0), (week.Rounds, week.Confirmed)));
    }

    [Fact]
    public async Task TheRounds_ByWhatHappenedToThem_AndTheActiveGroups()
    {
        await AddRoundAsync(Quinta, Now.AddDays(-2), closed: true, createdAt: Now.AddDays(-9));
        await AddRoundAsync(Quinta, Now.AddDays(-3), status: "canceled", createdAt: Now.AddDays(-9));
        await AddRoundAsync(Quinta, Now.AddDays(5), createdAt: Now.AddHours(-1));
        // 30 days and a minute ago: held, but the group is not active by it.
        await AddRoundAsync(Sabado, Now.AddDays(-30).AddMinutes(-1), createdAt: Now.AddDays(-80));

        var metrics = await CountAsync();

        Assert.Equal((4, 2, 1, 1, 1), (metrics.Created, metrics.Held, metrics.Closed, metrics.Canceled, metrics.ActiveGroups));
        Assert.Equal(
            [new WeeklyCount(new DateOnly(2026, 11, 9), 2), new WeeklyCount(new DateOnly(2026, 11, 23), 1)],
            metrics.CreatedByWeek.OrderBy(week => week.WeekStart));
    }

    [Fact]
    public async Task TheGroups_ComeByTheirCreation_WithTheirNames()
    {
        await AddGroupAsync(Sabado, "Sábado na praia", Now.AddDays(-10));
        await AddGroupAsync(Quinta, "Vôlei de quinta", Now.AddDays(-40));

        var groups = await AskAsync<IGroupsMetrics, IReadOnlyList<CountedGroup>>(metrics => metrics.ListAsync(TestContext.Current.CancellationToken));

        Assert.Equal(["Vôlei de quinta", "Sábado na praia"], groups.Select(group => group.Name));
        Assert.Equal([Quinta, Sabado], groups.Select(group => group.GroupId));
    }

    /// <summary>Criteria 19 and 21 end to end: the route joins the names and the gate; the answer has no id.</summary>
    [Fact]
    public async Task TheRoute_GivesTheGateByGroup_WithTheNameAndNoId()
    {
        await AddGroupAsync(Quinta, "Vôlei de quinta", DateTimeOffset.UtcNow.AddDays(-40));
        var held = await AddRoundAsync(Quinta, DateTimeOffset.UtcNow.AddHours(-2));
        await AnswerAsync(held, "going", "self", "web", 3);
        await AnswerAsync(held, "going", "admin", "app", 1);
        using var client = Api.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/v1/ops/metrics");
        var token = TestIdToken.Valid(Api.Key, FixedTimeProvider.WholeSecondNow()).With("sub", Operator).With("user_id", Operator).Sign();
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var body = JsonDocument.Parse(text);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var gate = body.RootElement.GetProperty("gate");
        var group = Assert.Single(gate.GetProperty("byGroup").EnumerateArray());
        Assert.Equal("Vôlei de quinta", group.GetProperty("name").GetString());
        Assert.Equal(0.75, group.GetProperty("count").GetProperty("rate").GetDouble());
        Assert.Equal(0.75, gate.GetProperty("total").GetProperty("rate").GetDouble());
        Assert.Equal(1, body.RootElement.GetProperty("groups").GetProperty("active").GetInt32());
        Assert.DoesNotContain(Quinta.ToString(), text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(held.ToString(), text, StringComparison.OrdinalIgnoreCase);
    }

    private Task<SessionsMetrics> CountAsync() =>
        AskAsync<ISessionsMetrics, SessionsMetrics>(metrics => metrics.CountAsync(Period, Now.AddDays(-30), TestContext.Current.CancellationToken));

    private Task AddGroupAsync(Guid id, string name, DateTimeOffset createdAt) =>
        ExecuteAsync("INSERT INTO groups.groups (id, name, created_at) VALUES (@id, @name, @created)", ("id", id), ("name", name), ("created", createdAt));

    private async Task<Guid> AddRoundAsync(Guid group, DateTimeOffset startsAt, string status = "scheduled", bool closed = false, DateTimeOffset? createdAt = null)
    {
        var id = Guid.NewGuid();
        var local = TimeZoneInfo.ConvertTime(startsAt, TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo"));
        await ExecuteAsync(
            """
            INSERT INTO sessions.rounds (id, group_id, local_date, local_time, time_zone, starts_at, venue, status, next_sequence, created_at, closed_at)
            VALUES (@id, @group, @date, @time, 'America/Sao_Paulo', @starts, 'Arena', @status, 1, @created, @closed)
            """,
            ("id", id),
            ("group", group),
            ("date", DateOnly.FromDateTime(local.DateTime)),
            ("time", TimeOnly.FromDateTime(local.DateTime)),
            ("starts", startsAt),
            ("status", status),
            ("created", createdAt ?? startsAt.AddDays(-7)),
            ("closed", closed ? startsAt.AddHours(3) : DBNull.Value));
        return id;
    }

    private async Task AnswerAsync(Guid round, string status, string source, string channel, int count)
    {
        for (var answer = 0; answer < count; answer++)
        {
            sequence++;
            await ExecuteAsync(
                """
                INSERT INTO sessions.attendances (round_id, member_id, status, sequence, source, responded_at, promoted_at, channel)
                VALUES (@round, gen_random_uuid(), @status, @sequence, @source, @responded, @promoted, @channel)
                """,
                ("round", round),
                ("status", status),
                ("sequence", sequence),
                ("source", source),
                ("responded", Now.AddDays(-1)),
                ("promoted", status == "promoted" ? Now.AddDays(-1) : DBNull.Value),
                ("channel", channel));
        }
    }
}
