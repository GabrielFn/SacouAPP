using Sacou.Modules.Groups;
using Sacou.Modules.Identity;
using Sacou.Modules.Matches;
using Sacou.Modules.Payments;
using Sacou.Modules.Sessions;
using Sacou.Modules.Stats;
using Sacou.Modules.Summaries;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks();
builder.Services
    .AddIdentityModule()
    .AddGroupsModule()
    .AddSessionsModule()
    .AddMatchesModule()
    .AddPaymentsModule()
    .AddSummariesModule()
    .AddStatsModule();

var app = builder.Build();

app.MapHealthChecks("/health");

app.Run();
