using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.InternalPump;

/// <summary>
/// <c>POST /internal/notifications/pump</c> (ADR 0069, D10 and D11): what Cloud Tasks calls when a try or a receipt is
/// due, and the daily Cloud Scheduler job calls to sweep what a crash left. Never the Firebase login: only the Google OIDC
/// token of the calling account (<see cref="ServiceCallers.Policy"/>), and every refusal is the same 401. Relays every
/// outbox, pumps and cleans up within <see cref="Budget"/>; idempotent, so a repeated call only finds less to do.
/// Always 204: what failed or did not fit is logged by its type and waits for the next call.
/// </summary>
internal static class InternalPumpEndpoint
{
    public const string Name = "InternalNotificationsPump";

    /// <summary>Within the 30 s the route promises, and well within Cloud Tasks' deadline.</summary>
    public static readonly TimeSpan Budget = TimeSpan.FromSeconds(25);

    public static IEndpointRouteBuilder MapInternalPump(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost(NotificationRoutes.InternalPump, HandleAsync).WithName(Name)
            .RequireAuthorization(ServiceCallers.Policy)
            // Not part of the app's contract (ADR 0042): only Google calls it.
            .ExcludeFromDescription();
        return endpoints;
    }

    private static async Task<NoContent> HandleAsync(
        IEnumerable<INotificationSource> sources,
        INotificationPump pump,
        INotificationRetention retention,
        IContentReportRetention reports,
        TimeProvider time,
        ILoggerFactory loggers)
    {
        var logger = loggers.CreateLogger(typeof(InternalPumpEndpoint).FullName!);
        using var budget = new CancellationTokenSource(Budget);
        var all = sources.ToList();
        foreach (var source in all)
        {
            await StepAsync("relay", () => source.RelayAsync(budget.Token), logger).ConfigureAwait(false);
        }

        await StepAsync("pump", () => pump.RunAsync(budget.Token), logger).ConfigureAwait(false);
        await StepAsync("cleanup", () => retention.CleanUpAsync(time.GetUtcNow(), budget.Token), logger).ConfigureAwait(false);
        foreach (var source in all)
        {
            await StepAsync("outbox-cleanup", () => source.CleanUpAsync(time.GetUtcNow(), budget.Token), logger).ConfigureAwait(false);
        }

        // The reports of E6.6 live 180 days (question 234): this route runs on the daily Cloud Scheduler sweep and on each
        // Cloud Tasks call, and each run deletes the older ones (ADR 0069, D10).
        await StepAsync("report-cleanup", () => reports.CleanUpAsync(time.GetUtcNow(), budget.Token), logger).ConfigureAwait(false);
        return TypedResults.NoContent();
    }

    private static async Task StepAsync(string step, Func<Task> run, ILogger logger)
    {
        try
        {
            await run().ConfigureAwait(false);
        }
#pragma warning disable CA1031 // One step's failure must leave the others going; the next call tries again (ADR 0069, D10).
        catch (Exception exception)
#pragma warning restore CA1031
        {
            NotificationLog.StepFailed(logger, step, exception.GetType().Name);
        }
    }
}
