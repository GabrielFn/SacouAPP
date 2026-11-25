namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// How long a deletion mark is kept (answer 222 of E6.2): the one value the reapply guard (E6.3) and the purge of E6.5
/// share. Longer than the 30 days of the backup bucket, so every dump that can still be restored has its marks.
/// </summary>
public static class DeletionMarkRetention
{
    public const int Days = 60;

    public static readonly TimeSpan Period = TimeSpan.FromDays(Days);

    /// <summary>A dump older than the retention may hold people whose marks are gone: reapplying would miss them.</summary>
    public static bool Covers(DateTimeOffset dumpCreatedAt, DateTimeOffset now) => dumpCreatedAt >= now - Period;
}

/// <summary>
/// What a reapply of the deletions did (E6.3), only numbers (ADR 0056, D11): the marks read from the current database,
/// those the restored one did not have, the accounts erased again and the groups left without an admin and with no one
/// to promote.
/// </summary>
public sealed record ReapplyDeletionsSummary(int Marks, int NewMarks, int AccountsErased, int GroupsWithoutAdmin, TimeSpan Elapsed);
