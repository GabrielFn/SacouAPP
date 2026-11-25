namespace Sacou.Modules.Identity.ReapplyDeletions;

/// <summary>The deletion marks of the current database, read in a read-only transaction and never written (E6.3, door 2).</summary>
internal interface IDeletionMarkSource
{
    Task<IReadOnlyList<DeletionMark>> ReadAllAsync(string connectionString, CancellationToken cancellationToken);
}

/// <summary>The restored database, the one the API is about to serve (E6.3).</summary>
internal interface IRestoredAccounts
{
    /// <summary>Writes every mark the database lacks, keeping the ones it has; how many were new.</summary>
    Task<int> CopyMarksAsync(IReadOnlyList<DeletionMark> marks, CancellationToken cancellationToken);

    /// <summary>
    /// The accounts whose login hash has a mark, in id order. The hash is taken by the database (door 3), so only the
    /// logins of these accounts reach the process, for the per-login lock of the delete.
    /// </summary>
    Task<IReadOnlyList<MarkedAccount>> FindMarkedAsync(CancellationToken cancellationToken);
}
