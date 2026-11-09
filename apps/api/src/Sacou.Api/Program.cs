using Microsoft.AspNetCore.Authorization;
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
// Secure by default: every endpoint needs a signed-in user, unless it says AllowAnonymous (ADR 0036, D7).
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services
    .AddIdentityModule(builder.Configuration)
    .AddGroupsModule()
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

if (app.Configuration.GetValue<bool>(MigrateOnStartupKey))
{
    await IdentityModule.MigrateAsync(app.Services);
}

await app.RunAsync();
