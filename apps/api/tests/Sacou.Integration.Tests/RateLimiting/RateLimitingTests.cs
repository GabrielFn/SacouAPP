using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Integration.Tests.RateLimiting;

/// <summary>
/// Cases 7 to 13 and 15 of E5.3a on the real API and a real Postgres: the per-user windows, low by configuration,
/// one host per test so no window carries over (ADR 0062).
/// </summary>
public sealed class RateLimitingTests(IntegrationDatabase database)
{
    private const string SignInPath = "/v1/me";
    private const string Section = "RateLimiting";
    private const string RateLimited = "api.rate-limited";
    private const string GroupBody = """{"name":"Racha do limite"}""";

    private static readonly TimeSpan TimerMargin = TimeSpan.FromMilliseconds(500);

    /// <summary>Case 7: the third sign-in of one person in the window is a 429; another person at the same time is not.</summary>
    [Fact]
    public async Task SignIn_PastTheLimit_Is429_ForThatPersonOnly()
    {
        await using var api = await StartAsync(Limit("SignIn", 2));
        using var client = api.CreateClient();
        var aSubject = NewSubject();
        var bSubject = NewSubject();

        using var first = await SendAsync(api, client, aSubject, HttpMethod.Post, SignInPath);
        using var second = await SendAsync(api, client, aSubject, HttpMethod.Post, SignInPath);
        using var third = await SendAsync(api, client, aSubject, HttpMethod.Post, SignInPath);
        using var other = await SendAsync(api, client, bSubject, HttpMethod.Post, SignInPath);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        await AssertRateLimitedAsync(third);
        Assert.Equal(HttpStatusCode.Created, other.StatusCode);
    }

    /// <summary>Case 8: the second draw in the window is a 429, and the handler never runs (no second draw log).</summary>
    [Fact]
    public async Task Draw_PastTheLimit_Is429_AndTheHandlerDoesNotRun()
    {
        await using var api = await StartAsync(Limit("Draw", 1));
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = await DrawCalls.RoundAsync(world);
        _ = await DrawCalls.ConfirmPlayersAsync(world, round, extra: 0);

        using var drawn = await DrawCalls.DrawAsync(world, round);
        using var refused = await DrawCalls.DrawAsync(world, round);

        Assert.Equal(HttpStatusCode.OK, drawn.StatusCode);
        await AssertRateLimitedAsync(refused);
        Assert.Single(api.Logs.Entries, entry => entry.Contains($"draw of round {round}", StringComparison.Ordinal));
    }

    /// <summary>Case 9: the second creation in the window is a 429, and only one group is written.</summary>
    [Fact]
    public async Task GroupCreate_PastTheLimit_Is429_AndWritesNothing()
    {
        await using var api = await StartAsync(Limit("GroupCreate", 1));
        using var client = api.CreateClient();
        var creatorSubject = NewSubject();
        var user = await RegisterAsync(api, client, creatorSubject);

        using var created = await SendAsync(api, client, creatorSubject, HttpMethod.Post, GroupWorld.GroupsPath, GroupBody);
        using var refused = await SendAsync(api, client, creatorSubject, HttpMethod.Post, GroupWorld.GroupsPath, GroupBody);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        await AssertRateLimitedAsync(refused);
        Assert.Equal(1, await GroupsOfAsync(api, user));
    }

    /// <summary>Case 10: the preview and the acceptance share one window.</summary>
    [Fact]
    public async Task InvitePreviewAndAccept_ShareTheWindow()
    {
        await using var api = await StartAsync(Limit("Invite", 1));
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var body = GroupWorld.TokenBody(world.Invite.Token);

        using var preview = await world.SendAsync(GroupActor.NonMember, HttpMethod.Post, GroupWorld.PreviewPath, body);
        using var accept = await world.SendAsync(GroupActor.NonMember, HttpMethod.Post, GroupWorld.AcceptPath, body);

        Assert.Equal(HttpStatusCode.OK, preview.StatusCode);
        await AssertRateLimitedAsync(accept);
    }

    /// <summary>Case 11, the only test with a real wait: after Retry-After seconds the window has turned and the call passes.</summary>
    [Fact]
    public async Task AfterRetryAfter_TheCallPasses()
    {
        await using var api = await StartAsync(Limit("SignIn", 1, windowSeconds: 1));
        using var client = api.CreateClient();
        var waitingSubject = NewSubject();
        _ = await RegisterAsync(api, client, waitingSubject);

        using var refused = await SendAsync(api, client, waitingSubject, HttpMethod.Post, SignInPath);
        await AssertRateLimitedAsync(refused);
        var wait = int.Parse(refused.Headers.GetValues("Retry-After").Single(), CultureInfo.InvariantCulture);
        // The window turns on the limiter's timer, which may tick a little after the second: a margin, not a retry.
        await Task.Delay(TimeSpan.FromSeconds(wait) + TimerMargin, TestContext.Current.CancellationToken);
        using var passed = await SendAsync(api, client, waitingSubject, HttpMethod.Post, SignInPath);

        Assert.Equal(1, wait);
        Assert.Equal(HttpStatusCode.OK, passed.StatusCode);
    }

    /// <summary>Case 12: a call without a token is a 401 before the limiter, and spends nothing.</summary>
    [Fact]
    public async Task WithoutAToken_Is401_AndSpendsNoQuota()
    {
        await using var api = await StartAsync(Limit("SignIn", 1).Concat(Limit("Global", 1)).ToDictionary());
        using var client = api.CreateClient();
        var afterSubject = NewSubject();

        using var first = await client.PostAsync(new Uri(SignInPath, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var second = await client.PostAsync(new Uri(SignInPath, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var signedIn = await SendAsync(api, client, afterSubject, HttpMethod.Post, SignInPath);

        Assert.Equal(HttpStatusCode.Unauthorized, first.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, second.StatusCode);
        Assert.Equal(HttpStatusCode.Created, signedIn.StatusCode);
    }

    /// <summary>Case 13: a route without a policy of its own still meets the global window.</summary>
    [Fact]
    public async Task RouteWithoutAPolicy_MeetsTheGlobalWindow()
    {
        await using var api = await StartAsync(Limit("Global", 3));
        using var client = api.CreateClient();
        var readerSubject = NewSubject();
        _ = await RegisterAsync(api, client, readerSubject);

        using var second = await SendAsync(api, client, readerSubject, HttpMethod.Get, GroupWorld.GroupsPath);
        using var third = await SendAsync(api, client, readerSubject, HttpMethod.Get, GroupWorld.GroupsPath);
        using var fourth = await SendAsync(api, client, readerSubject, HttpMethod.Get, GroupWorld.GroupsPath);

        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(HttpStatusCode.OK, third.StatusCode);
        await AssertRateLimitedAsync(fourth);
    }

    /// <summary>Case 15: five creations of one person at once: at most the window's permits pass, each with its group and member.</summary>
    [Fact]
    public async Task SimultaneousCreations_OfOnePerson_PassAtMostTheWindow()
    {
        const int Permits = 2;
        const int Creations = 5;
        await using var api = await StartAsync(Limit("GroupCreate", Permits));
        using var client = api.CreateClient();
        var hurriedSubject = NewSubject();
        var user = await RegisterAsync(api, client, hurriedSubject);

        using var gate = new Barrier(Creations);
        var statuses = await Task.WhenAll(Enumerable.Range(0, Creations).Select(async _ =>
        {
            await Task.Yield();
            gate.SignalAndWait(TestContext.Current.CancellationToken);
            using var response = await SendAsync(api, client, hurriedSubject, HttpMethod.Post, GroupWorld.GroupsPath, GroupBody);
            return response.StatusCode;
        }));

        Assert.Equal(Permits, statuses.Count(status => status == HttpStatusCode.Created));
        Assert.Equal(Creations - Permits, statuses.Count(status => status == HttpStatusCode.TooManyRequests));
        Assert.Equal(Permits, await GroupsOfAsync(api, user));
    }

    internal static Dictionary<string, string?> Limit(string window, int permits, int windowSeconds = 60) => new(StringComparer.Ordinal)
    {
        [$"{Section}:{window}:PermitLimit"] = permits.ToString(CultureInfo.InvariantCulture),
        [$"{Section}:{window}:WindowSeconds"] = windowSeconds.ToString(CultureInfo.InvariantCulture),
    };

    internal static async Task<ApiWithDatabase> StartAsync(IntegrationDatabase database, IReadOnlyDictionary<string, string?> settings)
    {
        var api = new ApiWithDatabase(database, settings);
        await api.MigrateAsync();
        return api;
    }

    internal static async Task AssertRateLimitedAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
        Assert.InRange(int.Parse(response.Headers.GetValues("Retry-After").Single(), CultureInfo.InvariantCulture), 1, int.MaxValue);
        Assert.Equal(RateLimited, await RoundCalls.CodeAsync(response));
    }

    internal static async Task<HttpResponseMessage> SendAsync(
        ApiWithDatabase api, HttpClient client, string subject, HttpMethod method, string path, string? json = null)
    {
        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(api, subject));
        if (json is not null)
        {
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    internal static async Task<Guid> RegisterAsync(ApiWithDatabase api, HttpClient client, string subject)
    {
        using var response = await SendAsync(api, client, subject, HttpMethod.Post, SignInPath);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await RoundCalls.JsonAsync(response);
        return body["userId"]!.GetValue<Guid>();
    }

    internal static async Task<long> GroupsOfAsync(ApiWithDatabase api, Guid user) =>
        await ScalarAsync(api, "SELECT count(*) FROM groups.members WHERE user_id = @user", user);

    internal static string NewSubject() => "uid-" + Guid.NewGuid().ToString("N");

    private Task<ApiWithDatabase> StartAsync(IReadOnlyDictionary<string, string?> settings) => StartAsync(database, settings);

    private static string TokenFor(ApiWithDatabase api, string subject) =>
        TestIdToken.Valid(api.Key, DateTimeOffset.FromUnixTimeSeconds(api.Clock.GetUtcNow().ToUnixTimeSeconds()))
            .With("sub", subject).With("user_id", subject).Sign();

    private static async Task<long> ScalarAsync(ApiWithDatabase api, string sql, Guid user)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("user", user);
        return (long)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }
}
