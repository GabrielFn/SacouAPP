namespace Sacou.Api.Operations;

/// <summary>
/// <c>GET /v1/ops/metrics</c> (E7.2, ADR 0085): only counts, rates (<c>0..1</c>, or null when nothing was counted),
/// instants, dates of weeks, the environment's label and, in the gate by group, the group's name (question 216). Never an
/// id, a nickname or a list of people: a reflection test holds the closed list of fields.
/// </summary>
/// <param name="Environment"><see cref="OpsEnvironments.Test"/> or <see cref="OpsEnvironments.Production"/>.</param>
/// <param name="GeneratedAt">When the counts were taken; the same while the cache holds them.</param>
/// <param name="CachedUntil">When a new request counts again.</param>
internal sealed record OpsMetricsResponse(
    string Environment,
    DateTimeOffset GeneratedAt,
    DateTimeOffset CachedUntil,
    OpsUsers Users);

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
