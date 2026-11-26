using Sacou.Shared.Metrics;

namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// The Identity's counts for the operator's dashboard (E7.2, ADR 0085, D2): numbers of the <c>identity</c> schema only,
/// never an id, a subject or any text.
/// </summary>
public interface IIdentityMetrics
{
    Task<IdentityMetrics> CountAsync(MetricsPeriod period, CancellationToken cancellationToken);
}

/// <param name="Registered">The rows of <c>identity.users</c> now.</param>
/// <param name="Deleted">The account erasures of the last 60 days, by their marks in <c>identity.deleted_accounts</c> (the purge of E6.5 takes the older ones).</param>
/// <param name="RegisteredByWeek">New users by the week of <c>created_at</c>, since the period's first week; a week without one is absent.</param>
/// <param name="DeletedByWeek">Erasures by the week of <c>deleted_at</c>, the same way.</param>
public sealed record IdentityMetrics(
    int Registered,
    int Deleted,
    IReadOnlyList<WeeklyCount> RegisteredByWeek,
    IReadOnlyList<WeeklyCount> DeletedByWeek);
