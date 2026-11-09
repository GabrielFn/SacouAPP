using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Npgsql;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Integration.Tests;

/// <summary>P1, P4, P5 and P6 of E3.1 on a real Postgres: the migration, the acceptance and the race.</summary>
public sealed class SignInDatabaseTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string SignInPath = "/v1/me";
    private const int ConcurrentSignIns = 16;
    private const int RaceRounds = 5;

    private readonly ApiWithDatabase api = new(database);

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task Migration_CreatesTheUsersTableInTheIdentitySchema()
    {
        await using var connection = await OpenAsync();

        Assert.Equal(
            ["created_at:timestamp with time zone:NO", "firebase_uid:text:NO", "id:uuid:NO"],
            await ReadAsync(connection, """
                SELECT column_name || ':' || data_type || ':' || is_nullable FROM information_schema.columns
                WHERE table_schema = 'identity' AND table_name = 'users' ORDER BY column_name
                """));
        Assert.Equal(
            ["ux_users_firebase_uid"],
            await ReadAsync(connection, "SELECT indexname FROM pg_indexes WHERE schemaname = 'identity' AND indexdef LIKE 'CREATE UNIQUE INDEX%(firebase_uid)'"));
        Assert.Equal(
            ["ck_users_firebase_uid_length"],
            await ReadAsync(connection, "SELECT conname FROM pg_constraint WHERE contype = 'c' AND conrelid = 'identity.users'::regclass"));
        Assert.Equal(
            ["__ef_migrations_history"],
            await ReadAsync(connection, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'identity' AND table_name LIKE '\\_\\_%'"));
    }

    [Fact]
    public async Task FirstSignIn_CreatesOneRowAndTheSecondFindsIt()
    {
        var subject = NewSubject();
        using var client = api.CreateClient();

        using var first = await SignInAsync(client, subject);
        using var second = await SignInAsync(client, subject);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(await UserIdAsync(first), await UserIdAsync(second));
        Assert.Equal(1, await CountAsync(subject));
        Assert.All(api.Keys.RequestedUris, uri => Assert.Equal("www.googleapis.com", uri?.Host));
    }

    [Fact]
    public async Task ConcurrentFirstSignIns_CreateExactlyOneUser()
    {
        using var client = api.CreateClient();
        for (var round = 0; round < RaceRounds; round++)
        {
            var subject = NewSubject();
            using var barrier = new Barrier(ConcurrentSignIns);
            var responses = await Task.WhenAll(Enumerable.Range(0, ConcurrentSignIns).Select(_ => Task.Run(
                () =>
                {
                    barrier.SignalAndWait(TestContext.Current.CancellationToken);
                    return SignInAsync(client, subject);
                },
                TestContext.Current.CancellationToken)));

            Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
            Assert.Equal(ConcurrentSignIns - 1, responses.Count(response => response.StatusCode == HttpStatusCode.OK));
            Assert.Single((await Task.WhenAll(responses.Select(UserIdAsync))).Distinct());
            Assert.Equal(1, await CountAsync(subject));
            Array.ForEach(responses, response => response.Dispose());
        }
    }

    [Fact]
    public async Task SubjectsDifferingOnlyInCase_AreTwoUsers()
    {
        var lower = "case-" + Guid.NewGuid().ToString("N");
        var upper = lower.ToUpperInvariant();
        using var client = api.CreateClient();

        using var first = await SignInAsync(client, lower);
        using var second = await SignInAsync(client, upper);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.NotEqual(await UserIdAsync(first), await UserIdAsync(second));
    }

    private static string NewSubject() => "uid-" + Guid.NewGuid().ToString("N");

    private async Task<HttpResponseMessage> SignInAsync(HttpClient client, string subject)
    {
        var token = TestIdToken.Valid(api.Key, FixedTimeProvider.WholeSecondNow()).With("sub", subject).With("user_id", subject).Sign();
        using var request = new HttpRequestMessage(HttpMethod.Post, SignInPath);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<string> UserIdAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>(TestContext.Current.CancellationToken);
        return Assert.Contains("userId", body!);
    }

    private async Task<long> CountAsync(string subject)
    {
        await using var connection = await OpenAsync();
        await using var count = new NpgsqlCommand("SELECT count(*) FROM identity.users WHERE firebase_uid = @uid", connection);
        count.Parameters.AddWithValue("uid", subject);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    private static async Task<List<string>> ReadAsync(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        var values = new List<string>();
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            values.Add(reader.GetString(0));
        }

        return values;
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }
}
