namespace Sacou.Shared.Persistence;

/// <summary>Instants as Postgres keeps them (<c>timestamptz</c> has whole microseconds).</summary>
public static class StoredInstant
{
    /// <summary>The instant cut to whole microseconds, so the first answer equals every later read from the database.</summary>
    public static DateTimeOffset Of(DateTimeOffset instant) =>
        instant.AddTicks(-(instant.Ticks % TimeSpan.TicksPerMicrosecond));
}
