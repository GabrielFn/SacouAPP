using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Identity;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Shared.Metrics;
using Sacou.Tests.TestSupport;

namespace Sacou.Api.Tests.Operations;

/// <summary>
/// The real API with the operator list of a test, the Google keys served by a stub, and the modules' counts replaced
/// by fakes that count their calls: the whole login and authorization path runs, without a database.
/// </summary>
internal sealed class OpsHost : IAsyncDisposable
{
    public const string Route = "/v1/ops/metrics";

    private readonly SacouApiFactory api;

    private readonly WebApplicationFactory<Program> factory;

    public OpsHost(string? operators, string environment = "Staging", IReadOnlyDictionary<string, string?>? settings = null, bool realMetrics = false)
    {
        api = new SacouApiFactory { Environment = environment };
        var keys = new StubHttpHandler(_ => StubHttpHandler.Json(TestSigningKeys.Document(Key), TimeSpan.FromHours(1)));
        factory = api.WithWebHostBuilder(builder =>
        {
            if (operators is not null)
            {
                builder.UseSetting("Operations:OperatorSubjects", operators);
            }

            foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
            {
                builder.UseSetting(key, value);
            }

            builder.ConfigureLogging(logging => logging.AddProvider(Logs));
            builder.ConfigureTestServices(services =>
            {
                if (!realMetrics)
                {
                    services.RemoveAll<IIdentityMetrics>();
                    services.AddSingleton<IIdentityMetrics>(Identity);
                    services.RemoveAll<IGroupsMetrics>();
                    services.AddSingleton<IGroupsMetrics>(new FixedGroupsMetrics());
                    services.RemoveAll<ISessionsMetrics>();
                    services.AddSingleton<ISessionsMetrics>(new FixedSessionsMetrics());
                }

                services.AddHttpClient(IdentityModule.SigningKeysHttpClientName)
                    .ConfigurePrimaryHttpMessageHandler(() => keys)
                    .SetHandlerLifetime(Timeout.InfiniteTimeSpan);
            });
        });
    }

    public static TestSigningKey Key => TestSigningKeys.Shared;

    public CollectingLoggerProvider Logs { get; } = new();

    public CountingIdentityMetrics Identity { get; } = new();

    public IServiceProvider Services => factory.Services;

    public HttpClient CreateClient() => factory.CreateClient();

    public static string TokenFor(string subject) =>
        TestIdToken.Valid(Key, FixedTimeProvider.WholeSecondNow()).With("sub", subject).With("user_id", subject).Sign();

    public static HttpRequestMessage Get(string? subject, string path = Route)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (subject is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", TokenFor(subject));
        }

        return request;
    }

    public async ValueTask DisposeAsync()
    {
        await factory.DisposeAsync();
        await api.DisposeAsync();
        Logs.Dispose();
    }
}

/// <summary>A fixed answer and the number of calls: a cached request never reaches it.</summary>
internal sealed class CountingIdentityMetrics : IIdentityMetrics
{
    private int calls;

    public int Calls => Volatile.Read(ref calls);

    public IdentityMetrics Answer { get; set; } = new(Registered: 7, Deleted: 1, RegisteredByWeek: [], DeletedByWeek: []);

    public Task<IdentityMetrics> CountAsync(MetricsPeriod period, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref calls);
        return Task.FromResult(Answer);
    }
}
