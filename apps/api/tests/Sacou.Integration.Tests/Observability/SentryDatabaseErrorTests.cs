using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Sacou.Tests.TestSupport;
using Sentry.AspNetCore;
using Sentry.Extensibility;
using Sentry.Protocol.Envelopes;
using Xunit;

namespace Sacou.Integration.Tests.Observability;

/// <summary>The Sentry SDK keeps a static hub: this class never runs beside another one.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class SentryDatabaseSequence
{
    public const string Name = "SentryDatabase";
}

/// <summary>
/// Case 12 and R2 of E5.2 on a real Postgres: a database error is one event, from the 500, and neither the SQL of the
/// EF Core command log nor a parameter value (here, the Firebase UID of the sign-in) reaches Sentry.
/// </summary>
[Collection(SentryDatabaseSequence.Name)]
public sealed class SentryDatabaseErrorTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string SignInPath = "/v1/me";
    private const string TestDsn = "https://publickey@sentry.invalid/1";
    private const string Subject = "uid-sentrymarcador";

    private static readonly TimeSpan FlushWait = TimeSpan.FromSeconds(5);

    private readonly string emptyDatabase = "sentry_" + Guid.NewGuid().ToString("N");

    private readonly CollectingTransport transport = new();

    private ApiWithDatabase? api;

    public async ValueTask InitializeAsync()
    {
        // No migration: the sign-in's first query fails on a table that does not exist.
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var create = new NpgsqlCommand($"CREATE DATABASE {emptyDatabase}", connection);
        await create.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        var empty = new NpgsqlConnectionStringBuilder(database.ConnectionString) { Database = emptyDatabase };
        api = new ApiWithDatabase(database, new Dictionary<string, string?>
        {
            ["ConnectionStrings:Sacou"] = empty.ConnectionString,
            ["SACOU_SENTRY_DSN"] = TestDsn,
        });
    }

    public async ValueTask DisposeAsync()
    {
        if (api is not null)
        {
            await api.DisposeAsync();
        }
    }

    [Fact]
    public async Task DatabaseError_IsOneEventWithoutTheSqlNorTheParameters()
    {
        await using var factory = api!.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.Configure<SentryAspNetCoreOptions>(options =>
            {
                options.Transport = transport;
                options.DisableAppDomainUnhandledExceptionCapture();
                options.DisableUnobservedTaskExceptionCapture();
            })));
        using var client = factory.CreateClient();
        var token = TestIdToken.Valid(api.Key, FixedTimeProvider.WholeSecondNow()).With("sub", Subject).With("user_id", Subject).Sign();
        using var request = new HttpRequestMessage(HttpMethod.Post, SignInPath);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        await factory.Services.GetRequiredService<IHub>().FlushAsync(FlushWait);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var envelope = Assert.Single(transport.Events);
        Assert.Contains("PostgresException", envelope, StringComparison.Ordinal);
        foreach (var marker in new[] { Subject, "sentrymarcador", "SELECT", "firebase_uid", "Failed executing DbCommand", "Microsoft.EntityFrameworkCore.Database" })
        {
            Assert.DoesNotContain(marker, envelope, StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>Keeps the serialized envelopes of events in memory instead of sending them.</summary>
    private sealed class CollectingTransport : ITransport
    {
        private readonly ConcurrentQueue<string> events = new();

        public IReadOnlyList<string> Events => [.. events];

        public async Task SendEnvelopeAsync(Envelope envelope, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(envelope);
            if (envelope.TryGetEventId() is null)
            {
                return;
            }

            using var stream = new MemoryStream();
            await envelope.SerializeAsync(stream, logger: null, cancellationToken).ConfigureAwait(false);
            events.Enqueue(Encoding.UTF8.GetString(stream.ToArray()));
        }
    }
}
