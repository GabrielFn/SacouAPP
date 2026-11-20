using Microsoft.Extensions.Logging.Abstractions;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Modules.Stats.Projections;
using Sacou.Modules.Stats.RatingParameters;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Projections;

/// <summary>3.9 of E3.9 without a database: a projection is rebuilt only when its key changes, and a pool only when its inputs do.</summary>
public sealed class StatsProjectorTests
{
    private static readonly Guid GroupId = Guid.Parse("00000000-0000-4000-8000-000000000001");
    private static readonly Guid RoundId = Guid.Parse("00000000-0000-4000-8000-000000000002");
    private static readonly Guid StreamId = Guid.Parse("00000000-0000-4000-8000-000000000003");
    private static readonly Guid Ana = Guid.Parse("00000000-0000-4000-8000-0000000000a1");
    private static readonly Guid Bia = Guid.Parse("00000000-0000-4000-8000-0000000000b1");
    private static readonly DateTimeOffset StartsAt = new(2026, 11, 20, 23, 30, 0, TimeSpan.Zero);
    private static readonly SummaryRules Indoor = new(GameModality.Indoor6x6, MvpEnabled: true, MvpByStats: true, IndividualPoints: false);

    private readonly FakeRounds rounds = new();
    private readonly FakeCourts courts = new();
    private readonly FakeStore store = new();
    private readonly FakeLevels levels = new();

    [Fact]
    public async Task RoundWithoutStream_IsAnEmptySummary_AndNothingIsReplayedNorStored()
    {
        rounds.Add(Round());

        var projection = await Projector().GetRoundAsync(GroupId, RoundId, TestContext.Current.CancellationToken);

        Assert.NotNull(projection);
        Assert.Same(SessionSummary.Empty, projection.Summary);
        Assert.Equal(0, courts.Summaries);
        Assert.Empty(store.Projections);
    }

    [Fact]
    public async Task RoundOfAnotherGroup_IsNull()
    {
        rounds.Add(Round());

        Assert.Null(await Projector().GetRoundAsync(GroupId, Guid.NewGuid(), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task StaleRound_IsRebuiltOnce_AndThenReadFromItsRow()
    {
        rounds.Add(Round());
        courts.Stream(StreamId, eventCount: 4);

        var first = await Projector().GetRoundAsync(GroupId, RoundId, TestContext.Current.CancellationToken);
        var second = await Projector().GetRoundAsync(GroupId, RoundId, TestContext.Current.CancellationToken);

        Assert.Equal(1, courts.Summaries);
        Assert.Equal(SummaryJson.Write(first!.Summary), SummaryJson.Write(second!.Summary));
        Assert.Equal(["w"], store.Members.Where(row => row.MemberId == Ana).Select(row => row.Results));
    }

    [Fact]
    public async Task MoreEvents_OrOtherFacts_RebuildTheRound()
    {
        rounds.Add(Round());
        courts.Stream(StreamId, eventCount: 4);
        _ = await Projector().GetGroupAsync(GroupId, TestContext.Current.CancellationToken);

        courts.Stream(StreamId, eventCount: 5);
        _ = await Projector().GetGroupAsync(GroupId, TestContext.Current.CancellationToken);
        rounds.Replace(Round() with { Summary = Indoor with { IndividualPoints = true } });
        _ = await Projector().GetGroupAsync(GroupId, TestContext.Current.CancellationToken);

        Assert.Equal(3, courts.Summaries);
    }

    [Fact]
    public async Task UnreadableStoredSummary_IsRebuilt()
    {
        rounds.Add(Round());
        courts.Stream(StreamId, eventCount: 4);
        _ = await Projector().GetGroupAsync(GroupId, TestContext.Current.CancellationToken);
        store.CorruptSummaries();

        var projection = await Projector().GetRoundAsync(GroupId, RoundId, TestContext.Current.CancellationToken);

        Assert.Equal(2, courts.Summaries);
        Assert.Single(projection!.Summary.FinishedMatches);
    }

    [Fact]
    public async Task CanceledRound_StaysReadable_ButCountsInNoSumNorRating()
    {
        rounds.Add(Round() with { State = RoundState.Canceled });
        courts.Stream(StreamId, eventCount: 4);

        var projection = await Projector().GetRoundAsync(GroupId, RoundId, TestContext.Current.CancellationToken);

        Assert.Single(projection!.Summary.FinishedMatches);
        Assert.False(Assert.Single(store.Projections.Values).Counts);
        Assert.Empty(store.Members);
        Assert.Empty(store.Ratings);
    }

    [Fact]
    public async Task Pool_IsSwappedOnlyWhenItsInputsChange_AndTheGradeIsAnInput()
    {
        rounds.Add(Round());
        courts.Stream(StreamId, eventCount: 4);
        _ = await Projector().GetGroupAsync(GroupId, TestContext.Current.CancellationToken);
        _ = await Projector().GetGroupAsync(GroupId, TestContext.Current.CancellationToken);
        Assert.Equal(2, store.Swaps);
        var before = store.Ratings.Single(row => row.MemberId == Bia);

        levels.Grade(Bia, 45, LevelSource.Admin);
        _ = await Projector().GetGroupAsync(GroupId, TestContext.Current.CancellationToken);

        var after = store.Ratings.Single(row => row.MemberId == Bia);
        Assert.Equal(3, store.Swaps);
        Assert.Equal((45, "admin"), (after.SeedTenths, after.SeedSource));
        Assert.NotEqual(before.Mu, after.Mu);
        Assert.Equal(1, after.MatchesRated);
    }

    [Fact]
    public async Task BeachRound_RatesTheBeachPool_AndLeavesTheIndoorOneEmpty()
    {
        rounds.Add(Round() with { Summary = Indoor with { Modality = GameModality.Beach2x2 } });
        courts.Stream(StreamId, eventCount: 4);

        _ = await Projector().GetGroupAsync(GroupId, TestContext.Current.CancellationToken);

        Assert.All(store.Ratings, row => Assert.Equal("beach", row.Pool));
        Assert.Equal(2, store.Ratings.Count);
    }

    private StatsProjector Projector()
    {
        var parameters = EmbeddedRatingParams.Load();
        var ratings = new RatingProjector(levels, store, parameters, TimeProvider.System, NullLogger<RatingProjector>.Instance);
        return new StatsProjector(rounds, courts, store, ratings, TimeProvider.System, NullLogger<StatsProjector>.Instance);
    }

    private static RoundFacts Round() => new(RoundId, RoundState.Scheduled, StartsAt, new DateOnly(2026, 11, 20), Indoor);

    /// <summary>Ana beats Bia once, 3 to 1.</summary>
    private static SessionSummary OneMatch() => new(
        1,
        [new FinishedMatchSummary(Guid.NewGuid(), CourtSide.A, [Ana], [Bia], [Ana], [Bia], 3, 1)],
        [Player(Ana, MatchOutcome.Win, 2, CourtSide.A), Player(Bia, MatchOutcome.Loss, -2, CourtSide.B)],
        new SideHighlightsSummary(new MostWinsSummary(CourtSide.A, 1), new LongestStreakSummary(CourtSide.A, 1)),
        new MvpSummary(MvpKind.Player, [Ana], CourtSide.A, 1, 1, 2, 1),
        Ranking: null);

    private static PlayerSummary Player(Guid memberId, MatchOutcome result, int plusMinus, CourtSide side) => new(
        memberId,
        1,
        result == MatchOutcome.Win ? 1 : 0,
        result == MatchOutcome.Loss ? 1 : 0,
        0,
        plusMinus > 0 ? 3 : 1,
        plusMinus > 0 ? 1 : 3,
        plusMinus,
        result == MatchOutcome.Win ? 1 : 0,
        result == MatchOutcome.Win ? 1 : 0,
        [result],
        new PointsByKindSummary(0, 0, 0, 0),
        side);

    private sealed class FakeRounds : IRoundFacts
    {
        private readonly List<RoundFacts> all = [];

        public void Add(RoundFacts facts) => all.Add(facts);

        public void Replace(RoundFacts facts)
        {
            all.Clear();
            all.Add(facts);
        }

        public Task<RoundFacts?> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken) =>
            Task.FromResult(all.FirstOrDefault(facts => facts.RoundId == roundId));

        public Task<IReadOnlyList<RoundFacts>> ListAsync(Guid groupId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RoundFacts>>(groupId == GroupId ? [.. all] : []);
    }

    private sealed class FakeCourts : ICourtSessionResults
    {
        private CourtStreamHead? head;

        public int Summaries { get; private set; }

        public void Stream(Guid courtSessionId, int eventCount) => head = new CourtStreamHead(RoundId, courtSessionId, eventCount);

        public Task<CourtStreamHead?> FindOfRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken) => Task.FromResult(head);

        public Task<IReadOnlyList<CourtStreamHead>> ListOfGroupAsync(Guid groupId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<CourtStreamHead>>(head is null ? [] : [head]);

        public Task<CourtSessionResults> SummarizeAsync(CourtStreamHead stream, SummaryRules rules, CancellationToken cancellationToken)
        {
            Summaries++;
            return Task.FromResult(new CourtSessionResults(stream.EventCount, OneMatch()));
        }
    }

    private sealed class FakeStore : IStatsStore
    {
        public Dictionary<Guid, RoundProjectionRow> Projections { get; } = [];

        public List<RoundMemberStatsRow> Members { get; } = [];

        public List<MemberRatingRow> Ratings { get; } = [];

        public int Swaps { get; private set; }

        private readonly Dictionary<string, RatingPoolRow> pools = new(StringComparer.Ordinal);

        public void CorruptSummaries()
        {
            foreach (var (roundId, row) in Projections.ToList())
            {
                Projections[roundId] = new RoundProjectionRow
                {
                    RoundId = row.RoundId, GroupId = row.GroupId, CourtSessionId = row.CourtSessionId, EventCount = row.EventCount,
                    ProjectionVersion = row.ProjectionVersion, FactsHash = row.FactsHash, StartsAt = row.StartsAt, LocalDate = row.LocalDate,
                    Counts = row.Counts, Modality = row.Modality, FinishedMatches = row.FinishedMatches, Summary = "{\"players\":7}",
                    RebuiltAt = row.RebuiltAt,
                };
            }
        }

        public Task<IReadOnlyList<RoundProjectionRow>> ListProjectionsAsync(Guid groupId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RoundProjectionRow>>([.. Projections.Values.Where(row => row.GroupId == groupId)]);

        public Task<bool> SaveProjectionAsync(RoundProjectionRow projection, IReadOnlyList<RoundMemberStatsRow> members, CancellationToken cancellationToken)
        {
            Projections[projection.RoundId] = projection;
            _ = Members.RemoveAll(row => row.RoundId == projection.RoundId);
            Members.AddRange(members);
            return Task.FromResult(true);
        }

        public Task<IReadOnlyList<RatingPoolRow>> ListPoolsAsync(Guid groupId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RatingPoolRow>>([.. pools.Values]);

        public Task SwapPoolAsync(RatingPoolRow pool, IReadOnlyList<MemberRatingRow> ratings, CancellationToken cancellationToken)
        {
            Swaps++;
            pools[pool.Pool] = pool;
            _ = Ratings.RemoveAll(row => row.Pool == pool.Pool);
            Ratings.AddRange(ratings);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeLevels : IMemberLevels
    {
        private readonly Dictionary<Guid, ResolvedLevel> graded = [];

        public void Grade(Guid memberId, int tenths, LevelSource source) => graded[memberId] = new ResolvedLevel(memberId, tenths, source);

        public Task<IReadOnlyList<ResolvedLevel>> ResolveAsync(Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<ResolvedLevel>>(
                [.. memberIds.Select(memberId => graded.GetValueOrDefault(memberId) ?? new ResolvedLevel(memberId, 30, LevelSource.Default))]);
    }
}
