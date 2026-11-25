using Sacou.Shared.Metrics;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>
/// The Sessions' counts for the operator's dashboard (E7.2, ADR 0085, D2): the rounds, and the answers of the rounds
/// held, by group and week. Numbers of the <c>sessions</c> schema only; the group id is the key the dashboard joins the
/// Groups' names by, never a member, a nickname or a round of its own.
/// </summary>
public interface ISessionsMetrics
{
    /// <param name="period">The weeks' zone, the instant of the counts and the first week shown.</param>
    /// <param name="activeSince">A group with a round held from this instant on is active.</param>
    /// <param name="cancellationToken">The request's.</param>
    Task<SessionsMetrics> CountAsync(MetricsPeriod period, DateTimeOffset activeSince, CancellationToken cancellationToken);
}

/// <param name="Created">Every round.</param>
/// <param name="Held">Not canceled, and already started (<c>starts_at</c> before now).</param>
/// <param name="Closed">With <c>closed_at</c>.</param>
/// <param name="Canceled">With the canceled status.</param>
/// <param name="ActiveGroups">Groups with a round held since <c>activeSince</c>.</param>
/// <param name="CreatedByWeek">Rounds by the week of <c>created_at</c>, since the first week shown.</param>
/// <param name="HeldByGroupWeek">The rounds held, all of them, by group and the week of <c>starts_at</c>, with their answers.</param>
public sealed record SessionsMetrics(
    int Created,
    int Held,
    int Closed,
    int Canceled,
    int ActiveGroups,
    IReadOnlyList<WeeklyCount> CreatedByWeek,
    IReadOnlyList<HeldWeek> HeldByGroupWeek);

/// <summary>
/// The rounds a group held in one week, and their answers as the rows hold them now (the last answer that changed the
/// row, ADR 0070, D3). Confirmed is <c>going</c> or <c>promoted</c>; the mensalistas' pre-confirmation
/// (<c>source = regular</c>) is in none of the three counts (question 215).
/// </summary>
/// <param name="GroupId">The key the dashboard joins the Groups' names by.</param>
/// <param name="WeekStart">The Monday of the week of <c>starts_at</c>.</param>
/// <param name="Rounds">The rounds held.</param>
/// <param name="Confirmed">The confirmed of those rounds, the mensalistas' pre-confirmation out.</param>
/// <param name="SelfAnswered">Of them, those who answered by themselves (<c>source = self</c>), by the link or the app.</param>
/// <param name="ByLink">Of them, those who answered by the round's link (<c>channel = web</c>).</param>
public sealed record HeldWeek(Guid GroupId, DateOnly WeekStart, int Rounds, int Confirmed, int SelfAnswered, int ByLink);
