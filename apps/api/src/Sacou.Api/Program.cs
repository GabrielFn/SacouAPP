using Microsoft.AspNetCore.Authorization;
using Sacou.Api.Configuration;
using Sacou.Api.OpenApi;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups;
using Sacou.Modules.Identity;
using Sacou.Modules.Matches;
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

builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();
// Request bodies: unknown fields and numeric enums are a 400 (ADR 0039).
builder.Services.AddApiJson();
// Secure by default: every endpoint needs a signed-in user, unless it says AllowAnonymous (ADR 0036, D7).
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services
    .AddIdentityModule(builder.Configuration)
    .AddGroupsModule(builder.Configuration)
    .AddSessionsModule(builder.Configuration)
    .AddMatchesModule(builder.Configuration)
    .AddPaymentsModule()
    .AddSummariesModule()
    .AddStatsModule();
// Per-user limits, and the concurrency of the two-connection routes (ADR 0062).
builder.Services.AddSacouRateLimiting(builder.Configuration);
builder.Services.AddSacouOpenApi();

var app = builder.Build();

// Cache-Control: no-store on the routes that ask for it, their errors too (ADR 0055).
app.UseNoStore();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
// After the authentication: a refused token is a 401 and never spends the quota (ADR 0062, D2).
app.UseSacouRateLimiting();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapIdentityEndpoints();
app.MapGroupsEndpoints();
app.MapSessionsEndpoints();
app.MapMatchesEndpoints();
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
    await IdentityModule.MigrateAsync(app.Services);
    await GroupsModule.MigrateAsync(app.Services);
    await SessionsModule.MigrateAsync(app.Services);
    await MatchesModule.MigrateAsync(app.Services);
}

await app.RunAsync();
