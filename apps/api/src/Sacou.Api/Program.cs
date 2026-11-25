using Microsoft.AspNetCore.Authorization;
using Sacou.Api.Configuration;
using Sacou.Api.Observability;
using Sacou.Api.Operations;
using Sacou.Api.OpenApi;
using Sacou.Api.Web;
using Sacou.Http;
using Sacou.Http.AppConfig;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups;
using Sacou.Modules.Identity;
using Sacou.Modules.Matches;
using Sacou.Modules.Notifications;
using Sacou.Modules.Payments;
using Sacou.Modules.Sessions;
using Sacou.Modules.Stats;
using Sacou.Modules.Summaries;

// Cloud Run sends SIGKILL 10 s after SIGTERM: the host stops on its own before that (ADR 0068, D11).
const int ShutdownTimeoutSeconds = 8;

var builder = WebApplication.CreateBuilder(args);

// Before the modules read ConnectionStrings:Sacou. The message never carries the URL or the password (ADR 0068, D5).
var database = DatabaseConnectionSetup.Apply(builder.Configuration, builder.Environment.IsDevelopment());
if (database.IsFailure)
{
    throw new InvalidOperationException(DatabaseConnectionSetup.FailureMessage(database.Error));
}

builder.Services.Configure<HostOptions>(options => options.ShutdownTimeout = TimeSpan.FromSeconds(ShutdownTimeoutSeconds));

// Errors to Sentry when its DSN is set, and the JSON logs of Cloud Logging outside Development (ADR 0080).
builder.AddSacouObservability();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();
// Request bodies: unknown fields and numeric enums are a 400 (ADR 0039).
builder.Services.AddApiJson();
// Secure by default: every endpoint needs a signed-in user, unless it says AllowAnonymous (ADR 0036, D7).
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services
    .AddIdentityModule(builder.Configuration)
    // Before the Groups: its account erasure runs before the Groups' one, which unlinks the member ids (ADR 0069, D9).
    .AddNotificationsModule(builder.Configuration)
    .AddGroupsModule(builder.Configuration)
    .AddSessionsModule(builder.Configuration)
    .AddMatchesModule(builder.Configuration)
    .AddPaymentsModule()
    .AddSummariesModule()
    .AddStatsModule(builder.Configuration);
// Per-user limits, and the concurrency of the two-connection routes (ADR 0062).
builder.Services.AddSacouRateLimiting(builder.Configuration);
// The minimum app build, the store pages and the feature flags of this environment (ADR 0084).
builder.Services.AddSacouAppConfig(builder.Configuration);
builder.Services.AddSacouOpenApi();
// The round's public page, its login and its files (E3.12, ADR 0070).
builder.Services.AddSacouWeb(builder.Configuration);
// The operator's dashboard: its list of UIDs, checked on start, and the 404 for anyone else (E7.2, ADR 0085).
builder.Services.AddSacouOperations(builder.Configuration);

var app = builder.Build();

// An operation command (E6.3, door 1): only with an argument on the container's command line, which the Cloud Run
// service never passes. It runs on the built services and exits: no port, no route, no middleware.
// The app is disposed before the exit, so the console logger and Sentry flush. The host never starts, so its console
// lifetime never hooks Ctrl+C: the command gets its own token, cancelled on Ctrl+C.
if (OperationCommands.TryMatch(args) is { } command)
{
    await using (app)
    {
        using var interrupted = new CancellationTokenSource();
        void OnCancelKeyPress(object? sender, ConsoleCancelEventArgs keyPress)
        {
            keyPress.Cancel = true;
            interrupted.Cancel();
        }

        Console.CancelKeyPress += OnCancelKeyPress;
        try
        {
            return await command.RunAsync(app.Services, Console.Out, interrupted.Token);
        }
        finally
        {
            Console.CancelKeyPress -= OnCancelKeyPress;
        }
    }
}

// Says by name when Sentry is off (ADR 0080, D1).
app.LogObservabilityState();

// The terms and the privacy policy are read now: an invalid text stops the start, never a page (E6.1, ADR 0083).
app.ReadSacouLegalDocuments();

// The headers of the round page and its files, on their paths only (ADR 0070, D5).
app.UseSacouWebHeaders();
// Cache-Control: no-store on the routes that ask for it, their errors too (ADR 0055).
app.UseNoStore();
app.UseExceptionHandler();
app.UseStatusCodePages();
// The page's script, styles, fonts and preview image: anonymous files, before the authentication (ADR 0070, D7).
app.UseSacouWebFiles();
// An app below the minimum build gets 426 before anything reads its token (ADR 0084).
app.UseSacouAppBuildGate();
app.UseAuthentication();
app.UseAuthorization();
// A route behind a flag that is off is a 404, after the 401 and before any database read (ADR 0084).
app.UseSacouFeatureGate();
// After the authentication: a refused token is a 401 and never spends the quota (ADR 0062, D2).
app.UseSacouRateLimiting();

app.MapHealthChecks("/health").AllowAnonymous();
// GET /v1/app-config: anonymous (the app asks before the sign-in), no database, limited per client address (ADR 0084).
app.MapAppConfig().AllowAnonymous().RequireRateLimiting(RateLimitPolicies.AppConfig);
app.MapIdentityEndpoints();
app.MapGroupsEndpoints();
app.MapSessionsEndpoints();
app.MapMatchesEndpoints();
app.MapStatsEndpoints();
app.MapNotificationsEndpoints();
// GET /v1/ops/metrics: only the subjects of Operations:OperatorSubjects (E7.2, ADR 0085, D1).
app.MapSacouOperations();
// GET /r/{code}: anonymous by design (the WhatsApp robot and whoever has the link), limited per client address (ADR 0070, D6).
app.MapSacouWeb().AllowAnonymous().RequireRateLimiting(RateLimitPolicies.RoundPage);
// A deliberate 500, the acceptance test of Sentry: never in Production (ADR 0080, D8).
if (DeliberateFailureEndpoint.IsMappedIn(app.Environment))
{
    app.MapDeliberateFailure();
}

// The contract lists every route, field and error code: only on a developer machine, never published (ADR 0042, D2).
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(SacouOpenApi.Route).AllowAnonymous();
}

// Builds every endpoint now, so a route that breaks a mapping rule (a group route without exactly one
// permission, ADR 0040, D4) stops the start instead of failing on its first call.
_ = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).Count();

if (app.Configuration.GetValue<bool>(DatabaseConnectionSetup.MigrateOnStartupKey))
{
    await DatabaseMigrations.ApplyAsync(app.Services, CancellationToken.None);
}

await app.RunAsync();
return 0;
