using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Series;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Modules.Sessions.RoundLinks;
using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>Case 2 of the E3.12 plan: a malformed code costs no query, and gets the answer of a code that found nothing.</summary>
public sealed class RoundLinkReaderTests
{
    [Theory]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn-")]
    [InlineData("K7fQ2xAbCdEfGhIjKlMn+_")]
    [InlineData(null)]
    public async Task MalformedCode_IsRefused_WithoutAQuery(string? code)
    {
        var store = new CountingStore();

        var found = await new RoundLinkReader(store).FindAsync(code, TestContext.Current.CancellationToken);

        Assert.Equal(RoundErrors.RoundLinkInvalid, found.Error);
        Assert.Equal(0, store.Lookups);
    }

    [Fact]
    public async Task WellFormedCodeOfNoRound_IsTheSameRefusal_AfterOneQuery()
    {
        var store = new CountingStore();

        var found = await new RoundLinkReader(store).FindAsync("AAAAAAAAAAAAAAAAAAAAAA", TestContext.Current.CancellationToken);

        Assert.Equal(RoundErrors.RoundLinkInvalid, found.Error);
        Assert.Equal(1, store.Lookups);
    }

    private sealed class CountingStore : IRoundStore
    {
        public int Lookups { get; private set; }

        public Task<Round?> FindByLinkCodeAsync(RoundLinkCode code, CancellationToken cancellationToken)
        {
            Lookups++;
            return Task.FromResult<Round?>(null);
        }

        public Task<Round?> FindAsync(GroupId group, RoundId round, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<IReadOnlyList<Round>> ListFromAsync(GroupId group, DateTimeOffset from, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Result<RoundChange>> ExecuteInRoundLockAsync(
            GroupId group, RoundId round, Func<Round, Task<Result<RoundChange>>> change, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Result<bool>> AddAsync(NewRound added, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<Result<RoundLinkCode>> AssignLinkCodeAsync(
            GroupId group, RoundId round, RoundLinkCode candidate, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<RoundSeries>> ListActiveSeriesAsync(GroupId group, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyDictionary<SeriesId, IReadOnlyList<SeriesOccurrence>>> ListOccurrencesAsync(
            IReadOnlyCollection<SeriesId> series, DateOnly since, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Result> StopSeriesAsync(GroupId group, SeriesId series, DateTimeOffset now, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
