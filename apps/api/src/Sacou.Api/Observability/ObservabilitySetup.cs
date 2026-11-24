using Microsoft.Extensions.DependencyInjection.Extensions;
using Sentry.AspNetCore;
using Sentry.Extensibility;

namespace Sacou.Api.Observability;

/// <summary>
/// Errors to Sentry and logs in the shape of Cloud Logging (ADR 0080). Sentry is off without
/// <see cref="SentryDsnVariable"/>: development, the CI and the tests never send anything (D1).
/// </summary>
internal static partial class ObservabilitySetup
{
    /// <summary>The Secret Manager secret <c>sacou-sentry-dsn-api</c>, read by the runtime account (D2).</summary>
    internal const string SentryDsnVariable = "SACOU_SENTRY_DSN";

    /// <summary>The release the deploy passes (the image digest); not a secret.</summary>
    internal const string SentryReleaseVariable = "SENTRY_RELEASE";

    /// <summary>The Google Cloud project of the trace field: the one the notification pump already names.</summary>
    internal const string ProjectIdKey = "NotificationTasks:Project";

    /// <summary>R1: the CPU is frozen between requests, so the event leaves before the response does, within 2 s.</summary>
    internal static readonly TimeSpan FlushTimeout = TimeSpan.FromSeconds(2);

    /// <summary>Breadcrumbs come only from the API's own loggers and from its outgoing HTTP calls (D3).</summary>
    private const string OwnCategoryPrefix = "Sacou.";
    private const string HttpCategory = "http";

    private const double EveryEvent = 1.0;
    private const double NoTrace = 0.0;

    /// <summary>Wires Sentry when the DSN is set, and the JSON console outside Development (D5).</summary>
    internal static WebApplicationBuilder AddSacouObservability(this WebApplicationBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        AddLogs(builder);
        var dsn = builder.Configuration[SentryDsnVariable];
        if (string.IsNullOrWhiteSpace(dsn))
        {
            return builder;
        }

        if (!IsValidDsn(dsn))
        {
            // Only the name: the value is a secret, and an invalid one may still be close to the real one.
            throw new InvalidOperationException($"{SentryDsnVariable} is not a valid Sentry DSN.");
        }

        var environment = builder.Environment.EnvironmentName.ToLowerInvariant();
        var release = builder.Configuration[SentryReleaseVariable];
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddSingleton<ISentryEventProcessor, RequestTagsProcessor>();
        builder.WebHost.UseSentry(options => Configure(options, dsn, environment, release));
        return builder;
    }

    /// <summary>
    /// The first middleware. Sentry off: a warning with the variable's name, never a value (D1). Sentry on: a failed
    /// request (500 and up) waits for its event to leave before it completes, because Cloud Run freezes the CPU once
    /// the request is over (R1; the SDK's own flush before completion is not public in this version).
    /// </summary>
    internal static WebApplication UseSacouObservability(this WebApplication app)
    {
        ArgumentNullException.ThrowIfNull(app);
        if (string.IsNullOrWhiteSpace(app.Configuration[SentryDsnVariable]))
        {
            SentryOff(app.Logger, SentryDsnVariable);
            return app;
        }

        var hub = app.Services.GetRequiredService<IHub>();
        app.Use(async (context, next) =>
        {
            await next(context);
            if (context.Response.StatusCode >= StatusCodes.Status500InternalServerError)
            {
                await hub.FlushAsync(FlushTimeout);
            }
        });
        return app;
    }

    internal static bool IsValidDsn(string dsn) =>
        Uri.TryCreate(dsn, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && uri.UserInfo.Length > 0
        && uri.AbsolutePath.Length > 1;

    /// <summary>Whether a breadcrumb may leave at all: the hosting logger writes the filled path, so it never does.</summary>
    internal static bool IsAllowedBreadcrumb(string? category) =>
        category is not null
        && (category.StartsWith(OwnCategoryPrefix, StringComparison.Ordinal) || category == HttpCategory);

    private static void Configure(SentryAspNetCoreOptions options, string dsn, string environment, string? release)
    {
        options.Dsn = dsn;
        options.Environment = environment;
        if (!string.IsNullOrWhiteSpace(release))
        {
            options.Release = release;
        }

        options.SendDefaultPii = false;
        options.MaxRequestBodySize = RequestSize.None;
        options.AttachStacktrace = true;
        options.SampleRate = (float)EveryEvent;
        options.TracesSampleRate = NoTrace;
        options.MinimumEventLevel = LogLevel.Error;
        options.MinimumBreadcrumbLevel = LogLevel.Information;
        options.ServerName = string.Empty;
        options.SetBeforeSend(SentryEventScrubber.Scrub);
        options.SetBeforeBreadcrumb(breadcrumb => IsAllowedBreadcrumb(breadcrumb.Category) ? SentryEventScrubber.Scrub(breadcrumb) : null);
    }

    private static void AddLogs(WebApplicationBuilder builder)
    {
        if (builder.Environment.IsDevelopment())
        {
            return;
        }

        var projectId = builder.Configuration[ProjectIdKey] ?? string.Empty;
        builder.Services.TryAddSingleton(TimeProvider.System);
        builder.Logging.ClearProviders();
        builder.Logging
            .AddConsole(options => options.FormatterName = CloudRunJsonFormatter.FormatterName)
            .AddConsoleFormatter<CloudRunJsonFormatter, CloudRunJsonFormatterOptions>(options =>
            {
                options.ProjectId = projectId;
                // The hosting scope carries the request path, with invite and round codes (D5).
                options.IncludeScopes = false;
            });
    }

    [LoggerMessage(EventId = 1, Level = LogLevel.Warning, Message = "Sentry is off: {Variable} is not set.")]
    private static partial void SentryOff(ILogger logger, string variable);
}
