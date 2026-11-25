using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions.Contracts;

namespace Sacou.Api.Operations;

/// <summary>
/// Asks each module's <c>*Metrics</c> contract for its counts (ADR 0085, D2) and joins them with
/// <see cref="OpsMetricsCalculator"/> and <see cref="OpsGateCalculator"/>. Scoped: the contracts hold their module's
/// database context. One after the other: each context has one connection.
/// </summary>
internal sealed class OpsMetricsReader(
    IIdentityMetrics identity,
    IGroupsMetrics groups,
    ISessionsMetrics sessions,
    IHostEnvironment environment)
{
    /// <summary>A group with a round held in this window is active (criterion 17).</summary>
    public static readonly TimeSpan ActiveWindow = TimeSpan.FromDays(30);

    public async Task<OpsMetricsResponse> ReadAsync(DateTimeOffset now, CancellationToken cancellationToken)
    {
        var period = OpsCalendar.PeriodAt(now);
        var weeks = OpsCalendar.Weeks(now);
        var users = await identity.CountAsync(period, cancellationToken).ConfigureAwait(false);
        var listed = await groups.ListAsync(cancellationToken).ConfigureAwait(false);
        var rounds = await sessions.CountAsync(period, now - ActiveWindow, cancellationToken).ConfigureAwait(false);
        return new OpsMetricsResponse(
            OpsEnvironments.Of(environment),
            now,
            now + OpsMetricsCache.Lifetime,
            OpsMetricsCalculator.Users(users, weeks),
            OpsMetricsCalculator.Groups(listed, rounds),
            OpsMetricsCalculator.Rounds(rounds, weeks),
            OpsGateCalculator.Gate(rounds.HeldByGroupWeek, listed, weeks));
    }
}
