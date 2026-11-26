namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// How long a deletion mark is kept (answer 222 of E6.2): the one value the reapply guard (E6.3) and the purge of E6.5
/// share. Longer than the 30 days of the backup bucket, so every dump that can still be restored has its marks.
/// </summary>
public static class DeletionMarkRetention
{
    public const int Days = 60;

    public static readonly TimeSpan Period = TimeSpan.FromDays(Days);

    /// <summary>The code of the refusal of a dump older than <see cref="Period"/>: the command tells it from any other failure.</summary>
    public const string DumpOlderThanRetentionCode = "identity.dump-older-than-mark-retention";

    /// <summary>A dump older than the retention may hold people whose marks are gone: reapplying would miss them.</summary>
    public static bool Covers(DateTimeOffset dumpCreatedAt, DateTimeOffset now) => dumpCreatedAt >= now - Period;
}

/// <summary>
/// What a reapply of the deletions did (E6.3), only numbers (ADR 0056, D11): the marks read from the current database,
/// those the restored one did not have, the accounts erased again and the groups left without an admin and with no one
/// to promote. A run that stopped on a database failure erased fewer accounts than it found (criterion 14): each step is
/// idempotent, so the next run finishes the rest.
/// </summary>
public sealed record ReapplyDeletionsSummary(int Marks, int NewMarks, int AccountsErased, int AccountsFound, int GroupsWithoutAdmin, TimeSpan Elapsed)
{
    public bool IsComplete => AccountsErased == AccountsFound;
}

/// <summary>The codes of the reapply's refusals (E6.3, S2): the command turns each into its exit code, never into a value.</summary>
public static class ReapplyDeletionsCodes
{
    /// <summary>The current database did not connect, refused the read or has no marks table (exit 3).</summary>
    public const string SourceUnreadable = "identity.deletions-source-unreadable";

    /// <summary>The source's role can write: it is the API's role, not the backup's read-only one (exit 2).</summary>
    public const string SourceCanWrite = "identity.deletions-source-can-write";

    /// <summary>
    /// The source reached the restored database itself, by another name for its server (<c>localhost</c> and
    /// <c>127.0.0.1</c>, an IP and its DNS name): the server says so after connecting (exit 2).
    /// </summary>
    public const string SourceIsTarget = "identity.deletions-source-is-target";

    /// <summary>
    /// The restored database has a mark, younger than the retention, that the source lacks: marks are only ever added
    /// (the purge of E6.5 takes the older ones), so the source is the older database and the variables were swapped (exit 2).
    /// </summary>
    public const string TargetAheadOfSource = "identity.deletions-target-ahead-of-source";

    /// <summary>A database failure while erasing; the run stops and the next one resumes (exit 5).</summary>
    public const string Interrupted = "identity.deletions-reapply-interrupted";
}
