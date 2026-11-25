namespace Sacou.Api.Operations;

/// <summary>
/// <c>GET /v1/ops/metrics</c> (E7.2, ADR 0085): only counts, rates (<c>0..1</c>, or null when nothing was counted),
/// instants, dates of weeks, the environment's label and, in the gate by group, the group's name (question 216). Never an
/// id, a nickname or a list of people: a reflection test holds the closed list of fields.
/// </summary>
/// <param name="Environment"><see cref="OpsEnvironments.Test"/> or <see cref="OpsEnvironments.Production"/>.</param>
/// <param name="GeneratedAt">When the counts were taken; the same while the cache holds them.</param>
/// <param name="CachedUntil">When a new request counts again.</param>
/// <param name="Users">The accounts: now, erased, and new and erased in each week shown.</param>
/// <param name="Groups">The groups, and those with a round held in the last 30 days.</param>
/// <param name="Rounds">The rounds by what happened to them, and the created ones by week.</param>
/// <param name="Gate">The gate of phase 2 (<c>produto.md:212</c>, question 215), by week, in total and by group.</param>
internal sealed record OpsMetricsResponse(
    string Environment,
    DateTimeOffset GeneratedAt,
    DateTimeOffset CachedUntil,
    OpsUsers Users,
    OpsGroups Groups,
    OpsRounds Rounds,
    OpsGate Gate);

/// <param name="Total">Every group.</param>
/// <param name="Active">With a round not canceled whose start was in the last 30 days.</param>
internal sealed record OpsGroups(int Total, int Active);

/// <param name="Created">Every round.</param>
/// <param name="Held">Not canceled and already started.</param>
/// <param name="Closed">Closed by an admin.</param>
/// <param name="Canceled">Canceled.</param>
/// <param name="Weeks">The rounds created in each week shown.</param>
internal sealed record OpsRounds(int Created, int Held, int Closed, int Canceled, IReadOnlyList<OpsRoundWeek> Weeks);

internal sealed record OpsRoundWeek(DateOnly WeekStart, int Created);

/// <summary>
/// The gate (question 215): of the confirmed of the rounds held, the mensalistas' pre-confirmation out, the share who
/// answered by themselves (<see cref="OpsGateCount.Rate"/>), and apart the share by the link (<see cref="OpsGateCount.LinkRate"/>).
/// </summary>
/// <param name="Target">The share the gate asks for (0.6).</param>
/// <param name="RequiredWeeks">The weeks in a row a group must hold rounds at the target (4).</param>
/// <param name="GroupsGoal">The groups that must meet it (5).</param>
/// <param name="GroupsMeeting">The groups that meet it now.</param>
/// <param name="Total">Every round held.</param>
/// <param name="Weeks">Each week shown, by the week of the round's start.</param>
/// <param name="ByGroup">Each group, by its creation.</param>
internal sealed record OpsGate(
    double Target,
    int RequiredWeeks,
    int GroupsGoal,
    int GroupsMeeting,
    OpsGateCount Total,
    IReadOnlyList<OpsGateWeek> Weeks,
    IReadOnlyList<OpsGateGroup> ByGroup);

/// <param name="Rounds">The rounds held.</param>
/// <param name="Confirmed">Their confirmed, without the mensalistas' pre-confirmation.</param>
/// <param name="SelfAnswered">Of them, who answered by themselves.</param>
/// <param name="ByLink">Of them, who answered by the link.</param>
/// <param name="Rate"><paramref name="SelfAnswered"/> ÷ <paramref name="Confirmed"/>; null with no confirmed.</param>
/// <param name="LinkRate"><paramref name="ByLink"/> ÷ <paramref name="Confirmed"/>; null with no confirmed.</param>
internal sealed record OpsGateCount(int Rounds, int Confirmed, int SelfAnswered, int ByLink, double? Rate, double? LinkRate);

internal sealed record OpsGateWeek(DateOnly WeekStart, OpsGateCount Count);

/// <param name="Name">The group's name (question 216): seen only by the operators, never logged.</param>
/// <param name="Count">Every round the group held.</param>
/// <param name="LongestStreak">The most weeks in a row with a round held.</param>
/// <param name="MeetsGate">At least <see cref="OpsGate.RequiredWeeks"/> weeks in a row, each one at the target or above.</param>
internal sealed record OpsGateGroup(string Name, OpsGateCount Count, int LongestStreak, bool MeetsGate);

/// <param name="Registered">The accounts now.</param>
/// <param name="Deleted">The accounts erased, ever.</param>
/// <param name="Weeks">The <see cref="OpsCalendar.WeekCount"/> weeks, the oldest first, each one present (0 when nothing).</param>
internal sealed record OpsUsers(int Registered, int Deleted, IReadOnlyList<OpsUserWeek> Weeks);

internal sealed record OpsUserWeek(DateOnly WeekStart, int Registered, int Deleted);

/// <summary>The environment's label: the page writes "Teste" or "Produção".</summary>
internal static class OpsEnvironments
{
    public const string Test = "test";
    public const string Production = "production";

    public static string Of(IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(environment);
        return environment.IsProduction() ? Production : Test;
    }
}
