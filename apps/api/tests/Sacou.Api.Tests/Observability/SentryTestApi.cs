using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sentry.AspNetCore;
using Sentry.Extensibility;
using Sentry.Protocol.Envelopes;
using Xunit;

namespace Sacou.Api.Tests.Observability;

/// <summary>The Sentry tests share the SDK's static hub: they never run beside each other.</summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class SentrySequence
{
    public const string Name = "Sentry";
}

/// <summary>A transport that keeps the envelopes in memory, serialized, instead of sending them.</summary>
internal sealed class CollectingTransport : ITransport
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

/// <summary>
/// The real API with a made-up DSN (nothing leaves: the transport is <see cref="Transport"/>), in
/// the given environment, signed in by a test scheme unless told otherwise.
/// </summary>
internal sealed class SentryTestApi : IAsyncDisposable
{
    internal const string TestDsn = "https://publickey@sentry.invalid/1";

    private readonly SacouApiFactory api;

    internal SentryTestApi(string environment, bool signedIn = true)
    {
        api = new SacouApiFactory { Environment = environment };
        Factory = api.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("SACOU_SENTRY_DSN", TestDsn);
            builder.ConfigureLogging(logging => logging.AddProvider(Logs));
            builder.ConfigureServices(services =>
            {
                services.Configure<SentryAspNetCoreOptions>(options =>
                {
                    options.Transport = Transport;
                    // Other tests' unobserved tasks must not reach this transport.
                    options.DisableAppDomainUnhandledExceptionCapture();
                    options.DisableUnobservedTaskExceptionCapture();
                });
                if (signedIn)
                {
                    services
                        .AddAuthentication()
                        .AddScheme<AuthenticationSchemeOptions, SignedInScheme>(SignedInScheme.Name, null)
                        .Services.PostConfigure<AuthenticationOptions>(options => options.DefaultScheme = SignedInScheme.Name);
                }
            });
        });
    }

    internal CollectingTransport Transport { get; } = new();

    internal Sacou.Tests.TestSupport.CollectingLoggerProvider Logs { get; } = new();

    internal WebApplicationFactory<Program> Factory { get; }

    internal async Task FlushAsync() => await Factory.Services.GetRequiredService<IHub>().FlushAsync(TimeSpan.FromSeconds(5));

    public async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        await api.DisposeAsync();
        Logs.Dispose();
    }

    private sealed class SignedInScheme(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        public const string Name = "SignedIn";

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "uid-sentry")], Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Name)));
        }
    }
}
