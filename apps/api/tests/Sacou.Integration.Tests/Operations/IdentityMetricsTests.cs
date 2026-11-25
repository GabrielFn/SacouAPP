using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Metrics;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Integration.Tests.Operations;

/// <summary>Criterion 6 of E7.2 on a real Postgres: the users and the erasures, in total and by the week of São Paulo.</summary>
public sealed class IdentityMetricsTests(IntegrationDatabase database) : MetricsDatabase(database)
{
    private const string Zone = "America/Sao_Paulo";

    /// <summary>From Monday 05/10/2026 00:00 in São Paulo.</summary>
    private static readonly MetricsPeriod Period = new(
        Zone, new DateTimeOffset(2026, 11, 24, 18, 0, 0, TimeSpan.Zero), new DateTimeOffset(2026, 10, 5, 3, 0, 0, TimeSpan.Zero));

    [Fact]
    public async Task Users_AreCountedByTheirWeekInSaoPaulo_AndBeforeThePeriodOnlyInTheTotal()
    {
        // Sunday 22/11 23:30 in São Paulo is Monday 02:30 UTC: the week of 16/11.
        await AddUserAsync("u-domingo", new DateTimeOffset(2026, 11, 23, 2, 30, 0, TimeSpan.Zero));
        // Monday 23/11 00:00 in São Paulo: the week of 23/11.
        await AddUserAsync("u-segunda", new DateTimeOffset(2026, 11, 23, 3, 0, 0, TimeSpan.Zero));
        await AddUserAsync("u-terca", new DateTimeOffset(2026, 11, 24, 12, 0, 0, TimeSpan.Zero));
        // A second before the period: only in the total.
        await AddUserAsync("u-antes", new DateTimeOffset(2026, 10, 5, 2, 59, 59, TimeSpan.Zero));
        await AddErasureAsync(new DateTimeOffset(2026, 10, 5, 3, 0, 0, TimeSpan.Zero));
        await AddErasureAsync(new DateTimeOffset(2026, 9, 1, 12, 0, 0, TimeSpan.Zero));

        var metrics = await AskAsync<IIdentityMetrics, IdentityMetrics>(identity => identity.CountAsync(Period, TestContext.Current.CancellationToken));

        Assert.Equal(4, metrics.Registered);
        Assert.Equal(2, metrics.Deleted);
        Assert.Equal(
            [new WeeklyCount(new DateOnly(2026, 11, 16), 1), new WeeklyCount(new DateOnly(2026, 11, 23), 2)],
            metrics.RegisteredByWeek.OrderBy(week => week.WeekStart));
        Assert.Equal([new WeeklyCount(new DateOnly(2026, 10, 5), 1)], metrics.DeletedByWeek);
    }

    /// <summary>Criterion 3 end to end: the operator's token, the real database, 200 with the users' section.</summary>
    [Fact]
    public async Task TheOperator_GetsTheCounts_ThroughTheRoute()
    {
        await AddUserAsync("u-rota", DateTimeOffset.UtcNow);
        using var client = Api.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/v1/ops/metrics");
        var token = TestIdToken.Valid(Api.Key, FixedTimeProvider.WholeSecondNow()).With("sub", Operator).With("user_id", Operator).Sign();
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("production", body.RootElement.GetProperty("environment").GetString());
        var users = body.RootElement.GetProperty("users");
        Assert.Equal(1, users.GetProperty("registered").GetInt32());
        Assert.Equal(8, users.GetProperty("weeks").GetArrayLength());
        Assert.Equal(1, users.GetProperty("weeks")[7].GetProperty("registered").GetInt32());
    }

    private Task AddUserAsync(string subject, DateTimeOffset createdAt) =>
        ExecuteAsync(
            "INSERT INTO identity.users (id, firebase_uid, created_at) VALUES (gen_random_uuid(), @subject, @created)",
            ("subject", subject),
            ("created", createdAt));

    private Task AddErasureAsync(DateTimeOffset deletedAt) =>
        ExecuteAsync(
            "INSERT INTO identity.deleted_accounts (subject_hash, deleted_at) VALUES (decode(md5(random()::text) || md5(random()::text), 'hex'), @deleted)",
            ("deleted", deletedAt));
}
