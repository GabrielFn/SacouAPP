using Sacou.Modules.Identity.Contracts;

namespace Sacou.Api.Operations;

/// <summary>
/// Asks each module's <c>*Metrics</c> contract for its counts (ADR 0085, D2) and joins them with
/// <see cref="OpsMetricsCalculator"/>. Scoped: the contracts hold their module's database context.
/// </summary>
internal sealed class OpsMetricsReader(IIdentityMetrics identity, IHostEnvironment environment)
{
    public async Task<OpsMetricsResponse> ReadAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var period = OpsCalendar.PeriodAt(now);
        var weeks = OpsCalendar.Weeks(now);
        var users = await identity.CountAsync(period, cancellationToken).ConfigureAwait(false);
        return new OpsMetricsResponse(
            OpsEnvironments.Of(environment),
            now,
            now + OpsMetricsCache.Lifetime,
            OpsMetricsCalculator.Users(users, weeks));
    }
}
