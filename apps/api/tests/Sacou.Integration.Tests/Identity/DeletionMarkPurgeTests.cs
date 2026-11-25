using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Sacou.Integration.Tests.Operations;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Retention;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Integration.Tests.Identity;

/// <summary>
/// S1 of E6.5 on a real Postgres of its own: the deletion marks older than 60 days go on the internal pump route's
/// sweep, the younger stay, and the person whose mark went signs in as anyone new. The cut is strict, the edge of
/// <see cref="DeletionMarkRetention.Covers"/>; the log has only the count.
/// </summary>
public sealed class DeletionMarkPurgeTests(IntegrationDatabase database) : MetricsDatabase(database)
{
    private const string Route = "/internal/notifications/pump";
    private const string MePath = "/v1/me";
    private const int BatchesAndOne = 1_001;
    private const string Purged = "Deletion marks purged:";

    private static readonly DateTimeOffset Now = new(2026, 11, 25, 12, 0, 0, TimeSpan.Zero);

    private protected override IReadOnlyDictionary<string, string?> MoreSettings => ApiWithDatabase.ServiceCallerSettings;

    /// <summary>Criteria 1, 2, 6 and 7: 59 days and exactly 60 stay, 60 days and 1 s and 61 go; again, nothing more goes.</summary>
    [Fact]
    public async Task TheMarksOlderThanSixtyDays_Go_TheOthersStay()
    {
        var marks = new Dictionary<string, DateTimeOffset>(StringComparer.Ordinal)
        {
            ["uid-59-dias"] = Now - TimeSpan.FromDays(59),
            ["uid-60-dias"] = Now - DeletionMarkRetention.Period,
            ["uid-60-dias-e-1-s"] = Now - DeletionMarkRetention.Period - TimeSpan.FromSeconds(1),
            ["uid-61-dias"] = Now - TimeSpan.FromDays(61),
        };
        foreach (var (subject, deletedAt) in marks)
        {
            await AddMarkAsync(subject, deletedAt);
        }

        var logsBefore = Api.Logs.Count;
        await CleanUpAsync(Now);

        Assert.Equal(["uid-59-dias", "uid-60-dias"], await RemainingAsync(marks.Keys));
        // Criterion 6: the oldest dump the reapply guard takes finds every mark it needs.
        Assert.True(DeletionMarkRetention.Covers(Now - DeletionMarkRetention.Period, Now));
        var logs = string.Join('\n', Api.Logs.EntriesSince(logsBefore));
        Assert.Contains($"{Purged} 2.", logs, StringComparison.Ordinal);
        Assert.All(marks.Keys.Select(HexOf), hex => Assert.DoesNotContain(hex, logs, StringComparison.OrdinalIgnoreCase));

        var logsAfterFirst = Api.Logs.Count;
        await CleanUpAsync(Now);

        Assert.Equal(["uid-59-dias", "uid-60-dias"], await RemainingAsync(marks.Keys));
        Assert.DoesNotContain(Purged, string.Join('\n', Api.Logs.EntriesSince(logsAfterFirst)), StringComparison.Ordinal);
    }

    /// <summary>Criterion 3: 1.001 expired marks, more than two batches, all go in one call; the young ones stay.</summary>
    [Fact]
    public async Task MoreExpiredMarksThanABatch_AllGoInOneCall()
    {
        await ExecuteAsync(
            $"INSERT INTO identity.deleted_accounts (subject_hash, deleted_at) SELECT sha256(('lote-' || g)::bytea), @deleted FROM generate_series(1, {BatchesAndOne}) AS g",
            ("deleted", Now - TimeSpan.FromDays(61)));
        string[] young = ["uid-jovem-1", "uid-jovem-2", "uid-jovem-3"];
        foreach (var subject in young)
        {
            await AddMarkAsync(subject, Now - TimeSpan.FromDays(59));
        }

        await CleanUpAsync(Now);

        Assert.Equal(0, await CountAsync("SELECT count(*) FROM identity.deleted_accounts WHERE deleted_at < @value", Now - DeletionMarkRetention.Period));
        Assert.Equal(young, await RemainingAsync(young));
    }

    /// <summary>Criteria 4 and 7 end to end: the route as Cloud Scheduler calls it, then the sign-in of both people.</summary>
    [Fact]
    public async Task AfterTheSweep_TheExpiredPersonSignsInAsNew_TheOtherIsStillGone()
    {
        var now = DateTimeOffset.UtcNow;
        await AddMarkAsync("uid-rota-61-dias", now - TimeSpan.FromDays(61));
        await AddMarkAsync("uid-rota-59-dias", now - TimeSpan.FromDays(59));
        using var client = Api.CreateClient();
        var logsBefore = Api.Logs.Count;

        using var swept = await CallRouteAsync(client, Api.ServiceCallerToken());
        using var expired = await SignInAsync(client, "uid-rota-61-dias");
        using var stillMarked = await SignInAsync(client, "uid-rota-59-dias");

        Assert.Equal(HttpStatusCode.NoContent, swept.StatusCode);
        Assert.Equal(HttpStatusCode.Created, expired.StatusCode);
        Assert.Equal(1, await CountAsync("SELECT count(*) FROM identity.users WHERE firebase_uid = @value", "uid-rota-61-dias"));
        Assert.Equal(HttpStatusCode.Gone, stillMarked.StatusCode);
        Assert.Contains("identity.account-deleted", await stillMarked.Content.ReadAsStringAsync(TestContext.Current.CancellationToken), StringComparison.Ordinal);
        Assert.Equal(0, await CountAsync("SELECT count(*) FROM identity.users WHERE firebase_uid = @value", "uid-rota-59-dias"));
        var logs = string.Join('\n', Api.Logs.EntriesSince(logsBefore));
        Assert.Contains($"{Purged} 1.", logs, StringComparison.Ordinal);
        Assert.DoesNotContain(HexOf("uid-rota-61-dias"), logs, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Criterion 8: without the accepted OIDC token (no token, a person's Firebase login), 401 and no mark goes.</summary>
    [Fact]
    public async Task WithoutTheCallerToken_NothingGoes()
    {
        await AddMarkAsync("uid-sem-token", DateTimeOffset.UtcNow - TimeSpan.FromDays(61));
        using var client = Api.CreateClient();
        var person = TestIdToken.Valid(Api.Key, FixedTimeProvider.WholeSecondNow()).With("sub", "uid-pessoa").With("user_id", "uid-pessoa").Sign();

        using var anonymous = await CallRouteAsync(client, token: null);
        using var firebase = await CallRouteAsync(client, person);

        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, firebase.StatusCode);
        Assert.Equal(["uid-sem-token"], await RemainingAsync(["uid-sem-token"]));
    }

    /// <summary>Criterion 5: a retention cleanup that throws is logged by its type, the purge still runs, and the route answers 204.</summary>
    [Fact]
    public async Task AFailingCleanup_LeavesThePurgeGoing()
    {
        await AddMarkAsync("uid-falha", DateTimeOffset.UtcNow - TimeSpan.FromDays(61));
        using var failing = Api.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.Insert(0, ServiceDescriptor.Scoped<IRetentionCleanup, FailingCleanup>())));
        using var client = failing.CreateClient();
        var logsBefore = Api.Logs.Count;

        using var swept = await CallRouteAsync(client, Api.ServiceCallerToken());

        Assert.Equal(HttpStatusCode.NoContent, swept.StatusCode);
        Assert.Empty(await RemainingAsync(["uid-falha"]));
        Assert.Contains(
            "Internal pump step retention-cleanup stopped: InvalidOperationException.",
            string.Join('\n', Api.Logs.EntriesSince(logsBefore)),
            StringComparison.Ordinal);
    }

    private static byte[] HashOf(string subject) => SHA256.HashData(Encoding.UTF8.GetBytes(subject));

    private static string HexOf(string subject) => Convert.ToHexString(HashOf(subject));

    private static async Task<HttpResponseMessage> CallRouteAsync(HttpClient client, string? token)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Route);
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task<HttpResponseMessage> SignInAsync(HttpClient client, string subject)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, MePath);
        var token = TestIdToken.Valid(Api.Key, FixedTimeProvider.WholeSecondNow()).With("sub", subject).With("user_id", subject).Sign();
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private Task AddMarkAsync(string subject, DateTimeOffset deletedAt) =>
        ExecuteAsync(
            "INSERT INTO identity.deleted_accounts (subject_hash, deleted_at) VALUES (@hash, @deleted)",
            ("hash", HashOf(subject)),
            ("deleted", deletedAt));

    /// <summary>Every retention cleanup of the API, with a fixed <paramref name="now"/>, as the route runs them.</summary>
    private async Task CleanUpAsync(DateTimeOffset now)
    {
        await using var scope = Api.Services.CreateAsyncScope();
        foreach (var cleanup in scope.ServiceProvider.GetServices<IRetentionCleanup>())
        {
            await cleanup.CleanUpAsync(now, TestContext.Current.CancellationToken);
        }
    }

    /// <summary>Which of <paramref name="subjects"/> still have a mark, in their order.</summary>
    private async Task<IReadOnlyList<string>> RemainingAsync(IEnumerable<string> subjects)
    {
        var remaining = new List<string>();
        foreach (var subject in subjects)
        {
            if (await CountAsync("SELECT count(*) FROM identity.deleted_accounts WHERE subject_hash = @value", HashOf(subject)) == 1)
            {
                remaining.Add(subject);
            }
        }

        return remaining;
    }

    private async Task<long> CountAsync(string sql, object value)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("value", value);
        return (long)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private sealed class FailingCleanup : IRetentionCleanup
    {
        public Task CleanUpAsync(DateTimeOffset now, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("A cleanup that fails.");
    }
}
