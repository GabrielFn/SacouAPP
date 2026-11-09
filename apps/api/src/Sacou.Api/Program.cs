using Microsoft.AspNetCore.Authorization;
using Sacou.Http;
using Sacou.Modules.Groups;
using Sacou.Modules.Identity;
using Sacou.Modules.Matches;
using Sacou.Modules.Payments;
using Sacou.Modules.Sessions;
using Sacou.Modules.Stats;
using Sacou.Modules.Summaries;

const string MigrateOnStartupKey = "Database:MigrateOnStartup";

var builder = WebApplication.CreateBuilder(args);

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
    .AddSessionsModule()
    .AddMatchesModule()
    .AddPaymentsModule()
    .AddSummariesModule()
    .AddStatsModule();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapIdentityEndpoints();
app.MapGroupsEndpoints();

if (app.Configuration.GetValue<bool>(MigrateOnStartupKey))
{
    await IdentityModule.MigrateAsync(app.Services);
    await GroupsModule.MigrateAsync(app.Services);
}

await app.RunAsync();
