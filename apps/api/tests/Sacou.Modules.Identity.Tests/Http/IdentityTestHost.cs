using System.Collections.Concurrent;
using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Primitives;
using Sacou.Http;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Http;

/// <summary>
/// The Identity module in a minimal host shaped like Program.cs, on a TestServer, with no database and
/// no network: users in memory, Google keys served by a stub handler on the real named client.
/// </summary>
internal sealed class IdentityTestHost : IAsyncDisposable
{
    public const string SignInPath = "/v1/me";

    private readonly WebApplication app;

    private IdentityTestHost(WebApplication app, StubHttpHandler keys, InMemoryUserStore users, CollectingLoggerProvider logs)
    {
        this.app = app;
        Keys = keys;
        Users = users;
        Logs = logs;
    }

    public StubHttpHandler Keys { get; }

    public InMemoryUserStore Users { get; }

    public CollectingLoggerProvider Logs { get; }

    public static Task<IdentityTestHost> StartAsync(params TestSigningKey[] keys) =>
        StartAsync(_ => StubHttpHandler.Json(TestSigningKeys.Document(keys), TimeSpan.FromHours(1)));

    public static async Task<IdentityTestHost> StartAsync(Func<HttpRequestMessage, HttpResponseMessage> keyResponses)
    {
        var stub = new StubHttpHandler(keyResponses);
        var users = new InMemoryUserStore();
        var logs = new CollectingLoggerProvider();
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = Environments.Production });
        builder.WebHost.UseTestServer();
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Firebase:ProjectId"] = TestIdToken.ProjectId,
            ["ConnectionStrings:Sacou"] = "Host=127.0.0.1;Port=1;Database=none",
        });
        // Same cut as appsettings.json: the hosting request line (with the query string) stays out of the logs.
        builder.Logging.ClearProviders().AddProvider(logs).SetMinimumLevel(LogLevel.Trace)
            .AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
        builder.Services.AddProblemDetails();
        builder.Services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
        builder.Services.AddIdentityModule(builder.Configuration);
        builder.Services.AddHttpClient(IdentityModule.SigningKeysHttpClientName)
            .ConfigurePrimaryHttpMessageHandler(() => stub)
            .SetHandlerLifetime(Timeout.InfiniteTimeSpan);
        builder.Services.Replace(ServiceDescriptor.Singleton<IUserStore>(users));
        builder.Services.Replace(ServiceDescriptor.Singleton<IDeletedAccountStore>(users));

        var app = builder.Build();
        app.UseExceptionHandler();
        app.UseNoStore();
        app.UseStatusCodePages();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapIdentityEndpoints();
        await app.StartAsync(TestContext.Current.CancellationToken);
        return new IdentityTestHost(app, stub, users, logs);
    }

    /// <summary>
    /// Sends the header values as they are: HttpClient would parse and rewrite them (two spaces become
    /// one), so the request goes straight to the TestServer.
    /// </summary>
    public async Task<HttpResponseMessage> SignInAsync(IReadOnlyList<string>? authorization, string path = SignInPath)
    {
        var target = new Uri(new Uri("http://localhost"), path);
        var context = await app.GetTestServer().SendAsync(
            http =>
            {
                http.Request.Method = HttpMethods.Post;
                http.Request.Path = target.AbsolutePath;
                http.Request.QueryString = new QueryString(target.Query);
                if (authorization is not null)
                {
                    http.Request.Headers.Authorization = new StringValues([.. authorization]);
                }
            },
            TestContext.Current.CancellationToken);
        return await ToResponseMessageAsync(context.Response);
    }

    private static async Task<HttpResponseMessage> ToResponseMessageAsync(HttpResponse response)
    {
        using var reader = new StreamReader(response.Body);
        var message = new HttpResponseMessage((HttpStatusCode)response.StatusCode)
        {
            Content = new StringContent(await reader.ReadToEndAsync(TestContext.Current.CancellationToken)),
        };
        message.Content.Headers.ContentType = response.ContentType is { } type
            ? System.Net.Http.Headers.MediaTypeHeaderValue.Parse(type)
            : null;
        foreach (var header in response.Headers.Where(header => header.Key != "Content-Type"))
        {
            message.Headers.TryAddWithoutValidation(header.Key, [.. header.Value]);
        }

        return message;
    }

    public Task<HttpResponseMessage> SignInAsync(string token) => SignInAsync([$"Bearer {token}"]);

    /// <summary>Any route, with one bearer token and an optional JSON body.</summary>
    public async Task<HttpResponseMessage> SendAsync(string method, string path, string token, string? body = null)
    {
        var context = await app.GetTestServer().SendAsync(
            http =>
            {
                http.Request.Method = method;
                http.Request.Path = path;
                http.Request.Headers.Authorization = $"Bearer {token}";
                if (body is not null)
                {
                    var bytes = System.Text.Encoding.UTF8.GetBytes(body);
                    http.Request.ContentType = "application/json";
                    http.Request.ContentLength = bytes.Length;
                    http.Request.Body = new MemoryStream(bytes);
                }
            },
            TestContext.Current.CancellationToken);
        return await ToResponseMessageAsync(context.Response);
    }

    public async ValueTask DisposeAsync()
    {
        await app.DisposeAsync();
    }
}

/// <summary>
/// The store the HTTP tests use: counts calls, so a refusal can prove it never reached it. Keeps the tombstones too
/// (by subject, in memory: the hashing is the Postgres store's), so a deleted subject is never created again.
/// </summary>
internal sealed class InMemoryUserStore : IUserStore, IDeletedAccountStore
{
    private readonly ConcurrentDictionary<string, UserId> users = new(StringComparer.Ordinal);
    private readonly ConcurrentDictionary<string, DateTimeOffset> deleted = new(StringComparer.Ordinal);
    private int calls;

    public int Calls => Volatile.Read(ref calls);

    public IReadOnlyCollection<string> Subjects => [.. users.Keys];

    public Task<UserId?> FindIdAsync(AuthSubject subject, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref calls);
        return Task.FromResult<UserId?>(users.TryGetValue(subject.Value, out var id) ? id : null);
    }

    public Task<DateTimeOffset?> FindCreatedAtAsync(UserId user, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref calls);
        return Task.FromResult<DateTimeOffset?>(null);
    }

    public Task<bool> TryCreateAsync(User user, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref calls);
        return Task.FromResult(!deleted.ContainsKey(user.Subject.Value) && users.TryAdd(user.Subject.Value, user.Id));
    }

    public IReadOnlyCollection<string> DeletedSubjects => [.. deleted.Keys];

    public Task<bool> IsDeletedAsync(AuthSubject subject, CancellationToken cancellationToken) =>
        Task.FromResult(deleted.ContainsKey(subject.Value));

    public Task DeleteAsync(UserId user, AuthSubject subject, DateTimeOffset now, CancellationToken cancellationToken)
    {
        deleted.TryAdd(subject.Value, now);
        users.TryRemove(subject.Value, out _);
        return Task.CompletedTask;
    }
}

internal static class ResponseAssert
{
    private const string TraceIdField = "traceId";

    /// <summary>The ProblemDetails body without the trace id, which changes per request.</summary>
    public static async Task<string> BodyWithoutTraceIdAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        var json = System.Text.Json.Nodes.JsonNode.Parse(body)!.AsObject();
        json.Remove(TraceIdField);
        return json.ToJsonString();
    }

    public static void IsBearerChallenge(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Bearer", Assert.Single(response.Headers.WwwAuthenticate).ToString());
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }
}
