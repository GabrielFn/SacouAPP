using System.Globalization;

namespace Sacou.Modules.Notifications.Application;

/// <summary>
/// Asks for a call of the internal pump route at a given time (ADR 0069, D10): Cloud Tasks in Cloud Run, nothing in
/// development and tests. Never fails its caller: an outage is logged, and the daily sweep or the next write catches up.
/// </summary>
internal interface INotificationScheduler
{
    Task ScheduleAsync(DateTimeOffset dueAt, CancellationToken cancellationToken);
}

/// <summary>Development, tests, and an API without the Cloud Tasks settings: the next write or the daily sweep pumps.</summary>
internal sealed class NoopNotificationScheduler : INotificationScheduler
{
    public Task ScheduleAsync(DateTimeOffset dueAt, CancellationToken cancellationToken) => Task.CompletedTask;
}

/// <summary>
/// The one-minute window a due time falls in, rounded up, and never before the next minute: every write of the same
/// minute names the same task (<c>pump-yyyyMMddHHmm</c>), so Cloud Tasks keeps one call (case E10).
/// </summary>
internal sealed record PumpWindow(DateTimeOffset StartsAt)
{
    private static readonly TimeSpan Width = TimeSpan.FromMinutes(1);

    public string TaskId => "pump-" + StartsAt.UtcDateTime.ToString("yyyyMMddHHmm", CultureInfo.InvariantCulture);

    public static PumpWindow Of(DateTimeOffset dueAt, DateTimeOffset now)
    {
        var earliest = now + Width;
        var at = dueAt < earliest ? earliest : dueAt;
        var ticks = at.UtcTicks;
        var remainder = ticks % Width.Ticks;
        return new PumpWindow(new DateTimeOffset(remainder == 0 ? ticks : ticks - remainder + Width.Ticks, TimeSpan.Zero));
    }
}
