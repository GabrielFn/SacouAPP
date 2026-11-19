using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Series;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>
/// A round to insert: the change that made it (with the mensalistas already seeded), the series it starts
/// (none for a one-off round or for an occurrence of an existing series), the time of creation, and whether
/// the group ceilings apply (they do not for an occurrence made by a series).
/// </summary>
internal sealed record NewRound(RoundChange Change, RoundSeries? NewSeries, DateTimeOffset Now, bool EnforceLimits);

/// <summary>
/// Where rounds live. A round is always read by <c>(group_id, id)</c> and a series by <c>(group_id, id)</c>:
/// never by a bare id (ADR 0040, D7; ADR 0043, D9).
/// </summary>
internal interface IRoundStore
{
    /// <summary>The round with its attendances, without a lock; null when the group has no such round.</summary>
    Task<Round?> FindAsync(GroupId group, RoundId round, CancellationToken cancellationToken);

    /// <summary>The rounds that start at or after <paramref name="from"/>, soonest first, with their attendances.</summary>
    Task<IReadOnlyList<Round>> ListFromAsync(GroupId group, DateTimeOffset from, CancellationToken cancellationToken);

    /// <summary>
    /// Every write to a round (ADR 0043, D5): one explicit READ COMMITTED transaction that starts with
    /// <c>SELECT ... FOR UPDATE</c> on the round's row, loads the round and its attendances, runs
    /// <paramref name="change"/> and writes the attendances and the round fields it changed. Writes to one round
    /// run one after another; rounds do not wait for each other. A missing round is <c>sessions.round-not-found</c>;
    /// a failed change writes nothing.
    /// </summary>
    Task<Result<RoundChange>> ExecuteInRoundLockAsync(
        GroupId group, RoundId round, Func<Round, Task<Result<RoundChange>>> change, CancellationToken cancellationToken);

    /// <summary>
    /// Inserts the round, its seeded attendances and its new series in one transaction. True when this call
    /// inserted the round; false when the series already had one on that date (<c>ON CONFLICT DO NOTHING</c>),
    /// in which case nothing was written. With limits on, a per-group lock makes the counts exact.
    /// </summary>
    Task<Result<bool>> AddAsync(NewRound added, CancellationToken cancellationToken);

    /// <summary>
    /// The round whose public link has this code, with its attendances, without a lock; null when none has it. The
    /// only read by something other than <c>(group_id, id)</c>: the code is the capability (ADR 0070, D1).
    /// </summary>
    Task<Round?> FindByLinkCodeAsync(RoundLinkCode code, CancellationToken cancellationToken);

    /// <summary>
    /// Gives <paramref name="candidate"/> to a round that has no code yet, and answers the code the round has after
    /// that (its earlier one, if it had). <c>sessions.round-link-code-taken</c> when the candidate is another round's.
    /// </summary>
    Task<Result<RoundLinkCode>> AssignLinkCodeAsync(GroupId group, RoundId round, RoundLinkCode candidate, CancellationToken cancellationToken);

    Task<IReadOnlyList<RoundSeries>> ListActiveSeriesAsync(GroupId group, CancellationToken cancellationToken);

    /// <summary>The occurrences of each series from <paramref name="since"/> on, to decide the next one.</summary>
    Task<IReadOnlyDictionary<SeriesId, IReadOnlyList<SeriesOccurrence>>> ListOccurrencesAsync(
        IReadOnlyCollection<SeriesId> series, DateOnly since, CancellationToken cancellationToken);

    /// <summary>Stops the series (again is a success); <c>sessions.series-not-found</c> for a series of another group.</summary>
    Task<Result> StopSeriesAsync(GroupId group, SeriesId series, DateTimeOffset now, CancellationToken cancellationToken);
}
