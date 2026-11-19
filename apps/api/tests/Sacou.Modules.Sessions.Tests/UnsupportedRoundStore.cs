using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Series;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>A store where every call fails the test, unless the fake of that test overrides it.</summary>
internal abstract class UnsupportedRoundStore : IRoundStore
{
    public virtual Task<Round?> FindAsync(GroupId group, RoundId round, CancellationToken cancellationToken) => throw new NotSupportedException();

    public virtual Task<IReadOnlyList<Round>> ListFromAsync(GroupId group, DateTimeOffset from, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public virtual Task<Result<RoundChange>> ExecuteInRoundLockAsync(
        GroupId group, RoundId round, Func<Round, Task<Result<RoundChange>>> change, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public virtual Task<Result<bool>> AddAsync(NewRound added, CancellationToken cancellationToken) => throw new NotSupportedException();

    public virtual Task<Round?> FindByLinkCodeAsync(RoundLinkCode code, CancellationToken cancellationToken) => throw new NotSupportedException();

    public virtual Task<Result<RoundLinkCode>> AssignLinkCodeAsync(
        GroupId group, RoundId round, RoundLinkCode candidate, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public virtual Task<IReadOnlyList<RoundSeries>> ListActiveSeriesAsync(GroupId group, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public virtual Task<IReadOnlyDictionary<SeriesId, IReadOnlyList<SeriesOccurrence>>> ListOccurrencesAsync(
        IReadOnlyCollection<SeriesId> series, DateOnly since, CancellationToken cancellationToken) =>
        throw new NotSupportedException();

    public virtual Task<Result> StopSeriesAsync(GroupId group, SeriesId series, DateTimeOffset now, CancellationToken cancellationToken) =>
        throw new NotSupportedException();
}
