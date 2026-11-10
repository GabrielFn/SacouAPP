using Microsoft.AspNetCore.Authorization;
using Sacou.Api.OpenApi;
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
builder.Services.AddSacouOpenApi();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health").AllowAnonymous();
app.MapIdentityEndpoints();
app.MapGroupsEndpoints();
// The contract lists every route, field and error code: only on a developer machine, never published (ADR 0042, D2).
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(SacouOpenApi.Route).AllowAnonymous();
}

// Builds every endpoint now, so a route that breaks a mapping rule (a group route without exactly one
// permission, ADR 0040, D4) stops the start instead of failing on its first call.
_ = ((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints).Count();

if (app.Configuration.GetValue<bool>(MigrateOnStartupKey))
{
    await IdentityModule.MigrateAsync(app.Services);
    await GroupsModule.MigrateAsync(app.Services);
}

await app.RunAsync();
