using Sacou.Api.Operations;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Shared.Metrics;

namespace Sacou.Api.Tests.Operations;

/// <summary>No group: the gate by group is empty.</summary>
internal sealed class FixedGroupsMetrics : IGroupsMetrics
{
    public Task<IReadOnlyList<CountedGroup>> ListAsync(CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<CountedGroup>>([]);
}

/// <summary>No round.</summary>
internal sealed class FixedSessionsMetrics : ISessionsMetrics
{
    public Task<SessionsMetrics> CountAsync(MetricsPeriod period, DateTimeOffset activeSince, CancellationToken cancellationToken) =>
        Task.FromResult(new SessionsMetrics(0, 0, 0, 0, 0, [], []));
}

/// <summary>Answers built by hand for the cache's tests.</summary>
internal static class OpsAnswers
{
    public static OpsMetricsResponse Empty(DateTimeOffset now) => new(
        OpsEnvironments.Test,
        now,
        now + OpsMetricsCache.Lifetime,
        new OpsUsers(0, 0, []),
        new OpsGroups(0, 0),
        new OpsRounds(0, 0, 0, 0, []),
        OpsGateCalculator.Gate([], [], []));
}
