using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.ReapplyDeletions;

/// <summary>
/// How long a deletion mark is kept (answer 222 of E6.2): the one value the reapply guard and the purge of E6.5 share.
/// Longer than the 30 days of the backup bucket, so every dump that can still be restored has its marks.
/// </summary>
public static class DeletionMarkRetention
{
    public const int Days = 60;

    public static readonly TimeSpan Period = TimeSpan.FromDays(Days);

    /// <summary>A dump older than the retention may hold people whose marks are gone: reapplying would miss them.</summary>
    public static bool Covers(DateTimeOffset dumpCreatedAt, DateTimeOffset now) => dumpCreatedAt >= now - Period;
}

public static class ReapplyDeletionsErrors
{
    public static readonly Error DumpOlderThanRetention = new("identity.dump-older-than-mark-retention", ErrorKind.Validation);
}
