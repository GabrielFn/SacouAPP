using Microsoft.Extensions.Options;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Modules.Stats.GetMvpVotingResult;
using Sacou.Modules.Stats.GetRoundSummary;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Modules.Stats.Projections;
using Sacou.Shared.Members;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Stats.Tests.MvpVoting;

/// <summary>
/// The result of the vote, frozen at the first read after the close (ADR 0072, D12), and the MVP of the summary after
/// the vote (R1 to R7, questions 142 and 143). No database: the stores are fakes.
/// </summary>
public sealed class MvpOutcomesTests
{
    private static readonly Guid GroupId = Guid.Parse("00000000-0000-4000-8000-000000000001");
    private static readonly Guid RoundId = Guid.Parse("00000000-0000-4000-8000-000000000002");
    private static readonly MemberId Ana = new(Guid.Parse("00000000-0000-4000-8000-0000000000a1"));
    private static readonly MemberId Bia = new(Guid.Parse("00000000-0000-4000-8000-0000000000b1"));
    private static readonly MemberId Caio = new(Guid.Parse("00000000-0000-4000-8000-0000000000c1"));
    private static readonly DateTimeOffset StartsAt = new(2026, 11, 20, 23, 30, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset WhileOpen = StartsAt.AddHours(7);
    private static readonly DateTimeOffset AfterTheClose = StartsAt.AddHours(31);
    private static readonly SummaryRules Both = new(GameModality.Indoor6x6, MvpEnabled: true, MvpByStats: true, IndividualPoints: false)
    {
        MvpVoting = true,
    };

    private readonly FakeVotes votes = new();
    private readonly FakeResults results = new();
    private readonly FixedTimeProvider time = new(WhileOpen);

    /// <summary>The condition of the security review of PR #184: a correction after the close does not move the result.</summary>
    [Fact]
    public async Task TheCount_IsFrozenAtTheFirstReadAfterTheClose_ACorrectionLaterKeepsIt()
    {
        votes.Add(Ana, Bia);
        votes.Add(Caio, Bia);
        time.Advance(AfterTheClose - WhileOpen);

        var first = await OutcomeAsync(Projection(Both));
        var corrected = Projection(Both, players: [Player(Ana, plusMinus: 9), Player(Caio, plusMinus: 1)]);
        var later = await OutcomeAsync(corrected);

        Assert.Equal([Bia], first!.Result!.Winners);
        Assert.Equal([Bia], later!.Result!.Winners);
        Assert.Equal(2, later.Result.Voters);
        Assert.Equal(1, results.Freezes);
    }

    /// <summary>
    /// Low 1 of E3.18 part 2 (ADR 0081, Part 2): the freezes of the profile and the export spend the request's budget
    /// of rebuilds; one past it has no count in this read and is frozen by the next.
    /// </summary>
    [Fact]
    public async Task FreezesPastTheBudgetOfTheRequest_WaitForTheNextRead()
    {
        votes.Add(Ana, Bia);
        time.Advance(AfterTheClose - WhileOpen);
        RoundProjection[] rounds = [Projection(Both, roundId: Guid.NewGuid()), Projection(Both, roundId: Guid.NewGuid())];

        var first = await OneFreezePerRequest().OfRoundsAsync(GroupId, rounds, TestContext.Current.CancellationToken);
        Assert.Single(first.Values, vote => vote.Result is not null);
        Assert.Equal(1, results.Freezes);

        var second = await OneFreezePerRequest().OfRoundsAsync(GroupId, rounds, TestContext.Current.CancellationToken);
        Assert.All(second.Values, vote => Assert.Equal([Bia], vote.Result!.Winners));
        Assert.Equal(2, results.Freezes);
    }

    [Fact]
    public async Task WhileOpen_NothingIsCounted_NorFrozen()
    {
        votes.Add(Ana, Bia);

        var outcome = await OutcomeAsync(Projection(Both));

        Assert.Equal(MvpVotingState.Open, outcome!.State);
        Assert.Null(outcome.Result);
        Assert.Equal(0, results.Freezes);
    }

    /// <summary>Two first reads at once: the store keeps the first count, and both answer it.</summary>
    [Fact]
    public async Task AFreezeThatLostTheRace_AnswersTheStoredCount()
    {
        results.Preset = new MvpTallyResult([Caio], Voters: 4);
        votes.Add(Ana, Bia);
        time.Advance(AfterTheClose - WhileOpen);

        var outcome = await OutcomeAsync(Projection(Both));

        Assert.Equal([Caio], outcome!.Result!.Winners);
        Assert.Equal(4, outcome.Result.Voters);
    }

    [Fact]
    public async Task ARoundWithoutTheVote_OrCancelled_HasNoVote()
    {
        time.Advance(AfterTheClose - WhileOpen);

        Assert.Null(await OutcomeAsync(Projection(Both with { MvpVoting = false })));
        Assert.Null(await OutcomeAsync(Projection(Both, state: RoundState.Canceled)));
        Assert.Equal(0, results.Freezes);
    }

    [Fact]
    public async Task R1_OnlyByStats_IsTheStatsMvp_WithoutTheNotice()
    {
        var report = await SummaryAsync(Projection(Both with { MvpVoting = false }));

        Assert.Equal(SummaryMvpSource.Stats, report.Mvp!.Source);
        Assert.Null(report.MvpVoting);
    }

    [Fact]
    public async Task R2_BothWhileOpen_IsTheStatsMvp_WithTheVoteOpen()
    {
        votes.Add(Ana, Bia);

        var report = await SummaryAsync(Projection(Both));

        Assert.Equal(SummaryMvpSource.Stats, report.Mvp!.Source);
        Assert.Equal([Ana.Value], report.Mvp.MemberIds);
        Assert.Equal(MvpVotingState.Open, report.MvpVoting!.State);
        Assert.Equal(StartsAt.AddHours(6), report.MvpVoting.OpensAt);
        Assert.Equal(StartsAt.AddHours(30), report.MvpVoting.ClosesAt);
    }

    [Fact]
    public async Task R3_BothClosedWithVotes_IsTheVotesMvp_WithTheWinnersNumbers()
    {
        votes.Add(Ana, Bia);
        time.Advance(AfterTheClose - WhileOpen);

        var report = await SummaryAsync(Projection(Both));

        Assert.Equal(SummaryMvpSource.Votes, report.Mvp!.Source);
        Assert.Equal(SummaryMvpKind.Player, report.Mvp.Kind);
        Assert.Equal([Bia.Value], report.Mvp.MemberIds);
        Assert.Equal(SummarySide.B, report.Mvp.Side);
        Assert.Equal(-2, report.Mvp.PlusMinus);
        Assert.Equal(MvpVotingState.Closed, report.MvpVoting!.State);
    }

    [Fact]
    public async Task R4_BothClosedWithoutVotes_FallsBackToTheStatsMvp()
    {
        time.Advance(AfterTheClose - WhileOpen);

        var report = await SummaryAsync(Projection(Both));

        Assert.Equal(SummaryMvpSource.Stats, report.Mvp!.Source);
        Assert.Equal([Ana.Value], report.Mvp.MemberIds);
    }

    [Fact]
    public async Task R5_OnlyTheVoteWhileOpen_HasNoMvp_AndTheNotice()
    {
        var onlyVote = Both with { MvpByStats = false };

        var report = await SummaryAsync(Projection(onlyVote, statsMvp: false));

        Assert.Null(report.Mvp);
        Assert.Equal(MvpVotingState.Open, report.MvpVoting!.State);
    }

    [Fact]
    public async Task R6_TheMvpOff_HasNoMvp_NorTheNotice()
    {
        time.Advance(AfterTheClose - WhileOpen);
        votes.Add(Ana, Bia);

        var report = await SummaryAsync(Projection(Both with { MvpEnabled = false }, statsMvp: false));

        Assert.Null(report.Mvp);
        Assert.Null(report.MvpVoting);
    }

    /// <summary>R7: on the sand the vote picks a person, not the pair of the ranking.</summary>
    [Fact]
    public async Task R7_OnTheSand_TheVotesMvpIsAPerson()
    {
        votes.Add(Ana, Bia);
        time.Advance(AfterTheClose - WhileOpen);
        var sand = Both with { Modality = GameModality.Beach2x2 };

        var report = await SummaryAsync(Projection(sand, statsMvp: true, team: true));

        Assert.Equal(SummaryMvpKind.Player, report.Mvp!.Kind);
        Assert.Equal([Bia.Value], report.Mvp.MemberIds);
    }

    [Fact]
    public async Task ASharedVotesMvp_HasEveryWinner_AndNoSide()
    {
        votes.Add(Ana, Bia);
        votes.Add(Bia, Ana);
        time.Advance(AfterTheClose - WhileOpen);
        var tied = Projection(Both, players: [Player(Ana, plusMinus: 3), Player(Bia, plusMinus: 3)]);

        var report = await SummaryAsync(tied);

        Assert.Equal(SummaryMvpSource.Votes, report.Mvp!.Source);
        Assert.Equal(2, report.Mvp.MemberIds.Count);
        Assert.Null(report.Mvp.Side);
    }

    /// <summary>S3 and question 144: the result has only the winners and how many voted; while open, neither.</summary>
    [Fact]
    public async Task S3_TheResult_HasOnlyTheWinnersAndHowManyVoted()
    {
        votes.Add(Ana, Bia);
        votes.Add(Caio, Bia);
        var open = MvpVotingResultResponse.From((await OutcomeAsync(Projection(Both)))!);
        time.Advance(AfterTheClose - WhileOpen);
        var closed = MvpVotingResultResponse.From((await OutcomeAsync(Projection(Both)))!);

        Assert.Equal((MvpVotingState.Open, null, null), (open.State, open.Winners, open.Voters));
        Assert.Equal(StartsAt.AddHours(30), open.ClosesAt);
        Assert.Equal([Bia.Value], closed.Winners);
        Assert.Equal(2, closed.Voters);
    }

    /// <summary>The result route: before the close nothing is counted nor frozen; at the close it is frozen once.</summary>
    [Fact]
    public async Task TheResultRoute_CountsOnlyAfterTheClose()
    {
        votes.Add(Ana, Bia);
        var ballot = ProjectedMvpVotingRounds.From(Projection(Both)).Value.Ballot;
        time.Advance(StartsAt.AddHours(1) - WhileOpen);
        var beforeOpen = await BallotOutcomeAsync(ballot);
        time.Advance(WhileOpen - StartsAt.AddHours(1));
        var open = await BallotOutcomeAsync(ballot);
        Assert.Equal(0, results.Freezes);

        time.Advance(AfterTheClose - WhileOpen);
        var closed = await BallotOutcomeAsync(ballot);
        var again = await BallotOutcomeAsync(ballot);

        Assert.Equal((MvpVotingState.NotOpen, null), (beforeOpen.State, beforeOpen.Result));
        Assert.Equal((MvpVotingState.Open, null), (open.State, open.Result));
        Assert.Equal([Bia], closed.Result!.Winners);
        Assert.Equal([Bia], again.Result!.Winners);
        Assert.Equal(1, results.Freezes);
    }

    private Task<RoundMvpVote> BallotOutcomeAsync(MvpBallot ballot) =>
        new MvpOutcomes(votes, results, new RebuildBudget(Options.Create(new StatsRebuildOptions())), new GroupRebuildGate(Options.Create(new StatsRebuildOptions())), time).OfBallotAsync(GroupId, RoundId, ballot, TestContext.Current.CancellationToken);

    private Task<RoundMvpVote?> OutcomeAsync(RoundProjection round) =>
        new MvpOutcomes(votes, results, new RebuildBudget(Options.Create(new StatsRebuildOptions())), new GroupRebuildGate(Options.Create(new StatsRebuildOptions())), time).OfRoundAsync(GroupId, round, TestContext.Current.CancellationToken);

    private MvpOutcomes OneFreezePerRequest() => new(
        votes,
        results,
        new RebuildBudget(Options.Create(new StatsRebuildOptions { MaxRebuildsPerRequest = 1 })),
        new GroupRebuildGate(Options.Create(new StatsRebuildOptions())),
        time);

    private async Task<RoundSummaryReport> SummaryAsync(RoundProjection round) =>
        RoundSummaryReport.From(round, await OutcomeAsync(round));

    private static RoundProjection Projection(
        SummaryRules rules,
        RoundState state = RoundState.Scheduled,
        IReadOnlyList<PlayerSummary>? players = null,
        bool statsMvp = true,
        bool team = false,
        Guid? roundId = null)
    {
        var id = roundId ?? RoundId;
        var facts = new RoundFacts(id, state, StartsAt, DateOnly.FromDateTime(StartsAt.UtcDateTime), rules);
        var mvp = team
            ? new MvpSummary(MvpKind.Team, [Ana.Value, Caio.Value], null, 5, 2, 2, 2)
            : new MvpSummary(MvpKind.Player, [Ana.Value], CourtSide.A, 5, 2, 2, 2);
        var summary = SessionSummary.Empty with
        {
            Players = players ?? [Player(Ana, plusMinus: 5, CourtSide.A), Player(Bia, plusMinus: -2, CourtSide.B), Player(Caio, plusMinus: 1)],
            Mvp = statsMvp ? mvp : null,
        };
        return new RoundProjection(facts, new CourtStreamHead(id, Guid.NewGuid(), EventCount: 10), 10, "hash", summary);
    }

    private static PlayerSummary Player(MemberId member, int plusMinus, CourtSide? side = null) =>
        new(member.Value, MatchesPlayed: 2, Wins: 1, Losses: 1, Undecided: 0, PointsFor: 0, PointsAgainst: 0, plusMinus,
            LongestWinStreak: 1, CurrentWinStreak: 0, [], new PointsByKindSummary(0, 0, 0, 0), side);

    private sealed class FakeVotes : IMvpVoteStore
    {
        private readonly List<MvpVote> stored = [];

        public void Add(MemberId voter, MemberId candidate) => stored.Add(new MvpVote(voter, candidate, WhileOpen));

        public Task<bool> TryCastAsync(Guid groupId, Guid roundId, MvpVote vote, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<MvpVote?> FindMineAsync(Guid groupId, Guid roundId, MemberId voter, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<MvpVote>> ListForRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MvpVote>>([.. stored]);

        public Task<IReadOnlyList<GivenMvpVote>> ListGivenAsync(Guid groupId, MemberId voter, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }

    /// <summary>Keeps the first count of a round, as the table's key does.</summary>
    private sealed class FakeResults : IMvpResultStore
    {
        private readonly Dictionary<Guid, MvpTallyResult> stored = [];

        public int Freezes { get; private set; }

        /// <summary>A count another read stored first, seen only at the freeze (the race).</summary>
        public MvpTallyResult? Preset { get; set; }

        public Task<IReadOnlyDictionary<Guid, MvpTallyResult>> ListForGroupAsync(Guid groupId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyDictionary<Guid, MvpTallyResult>>(new Dictionary<Guid, MvpTallyResult>(stored));

        public Task<MvpTallyResult> FreezeAsync(
            Guid groupId, Guid roundId, MvpTallyResult result, DateTimeOffset talliedAt, CancellationToken cancellationToken)
        {
            Freezes++;
            var kept = Preset ?? result;
            _ = stored.TryAdd(roundId, kept);
            return Task.FromResult(stored[roundId]);
        }
    }
}
