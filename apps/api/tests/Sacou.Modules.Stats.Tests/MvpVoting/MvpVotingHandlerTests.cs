using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.CastMvpVote;
using Sacou.Modules.Stats.Domain.MvpVoting;
using Sacou.Modules.Stats.GetMvpVoting;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Modules.Stats.Projections;
using Sacou.Shared.Members;
using Sacou.Shared.Results;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Stats.Tests.MvpVoting;

/// <summary>The ballot and the vote without a database (ADR 0072): E1, E9 to E12, the secret (S2, S4) and the race (D9).</summary>
public sealed class MvpVotingHandlerTests : IDisposable
{
    private static readonly Guid GroupId = Guid.Parse("00000000-0000-4000-8000-000000000001");
    private static readonly Guid RoundId = Guid.Parse("00000000-0000-4000-8000-000000000002");
    private static readonly MemberId Ana = new(Guid.Parse("00000000-0000-4000-8000-0000000000a1"));
    private static readonly MemberId Bia = new(Guid.Parse("00000000-0000-4000-8000-0000000000b1"));
    private static readonly MemberId Caio = new(Guid.Parse("00000000-0000-4000-8000-0000000000c1"));
    private static readonly DateTimeOffset StartsAt = new(2026, 11, 20, 23, 30, 0, TimeSpan.Zero);
    private static readonly SummaryRules Voting = new(GameModality.Indoor6x6, MvpEnabled: true, MvpByStats: true, IndividualPoints: false)
    {
        MvpVoting = true,
    };

    private readonly FakeVotes votes = new();
    private readonly CollectingLoggerProvider logs = new();
    private readonly ILoggerFactory loggers;
    private readonly FixedTimeProvider time = new(StartsAt.AddHours(7));

    public MvpVotingHandlerTests() => loggers = LoggerFactory.Create(builder => builder.AddProvider(logs));

    public void Dispose()
    {
        loggers.Dispose();
        logs.Dispose();
    }

    [Fact]
    public async Task E1_AValidVote_IsStoredAndAnswered()
    {
        var cast = await CastAsync(Ana, Bia.Value.ToString());

        Assert.True(cast.IsSuccess);
        Assert.Equal(Bia.Value, cast.Value.CandidateMemberId);
        Assert.Equal(time.GetUtcNow(), cast.Value.CastAt);
        Assert.Equal(new MvpVote(Ana, Bia, time.GetUtcNow()), Assert.Single(votes.Stored));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-guid")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public async Task E12_ACandidateThatIsNotAnId_IsInvalid_AndNothingIsStored(string? candidate)
    {
        var cast = await CastAsync(Ana, candidate);

        Assert.Equal(MvpVotingErrors.VoteInvalid, cast.Error);
        Assert.Empty(votes.Stored);
    }

    /// <summary>D9: two taps pass the read at once; the store's key refuses the second one.</summary>
    [Fact]
    public async Task ASecondVoteLostOnTheKey_IsAlreadyVoted()
    {
        votes.RefuseNext = true;

        Assert.Equal(MvpVotingErrors.AlreadyVoted, (await CastAsync(Ana, Bia.Value.ToString())).Error);
    }

    [Fact]
    public async Task AVoteAfterTheFirst_IsAlreadyVoted_AndKeepsTheFirst()
    {
        _ = await CastAsync(Ana, Bia.Value.ToString());

        var second = await CastAsync(Ana, Caio.Value.ToString());

        Assert.Equal(MvpVotingErrors.AlreadyVoted, second.Error);
        Assert.Equal(Bia, Assert.Single(votes.Stored).Candidate);
    }

    /// <summary>S4: the log line of a vote has the round and the result, never the voter nor the candidate.</summary>
    [Fact]
    public async Task S4_TheLogOfAVote_NeverHasTheVoterNorTheCandidate()
    {
        _ = await CastAsync(Ana, Bia.Value.ToString());
        _ = await CastAsync(Ana, Ana.Value.ToString());
        _ = await CastAsync(Bia, Guid.NewGuid().ToString());

        Assert.Contains(logs.Entries, entry => entry.Contains(RoundId.ToString(), StringComparison.Ordinal) && entry.Contains(MvpVotingLog.CastResult, StringComparison.Ordinal));
        Assert.Contains(logs.Entries, entry => entry.Contains(MvpVotingErrors.SelfVote.Code, StringComparison.Ordinal));
        Assert.All(logs.Entries, entry =>
        {
            Assert.DoesNotContain(Ana.Value.ToString(), entry, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(Bia.Value.ToString(), entry, StringComparison.OrdinalIgnoreCase);
        });
    }

    /// <summary>S2: the ballot of Bia never has the vote of Ana; only one's own vote comes back.</summary>
    [Fact]
    public async Task S2_TheBallot_HasOnlyTheCallersOwnVote()
    {
        _ = await CastAsync(Ana, Caio.Value.ToString());

        var ofBia = (await BallotAsync(Bia)).Value;
        var ofAna = (await BallotAsync(Ana)).Value;

        Assert.Null(ofBia.MyVote);
        Assert.True(ofBia.CanVote);
        Assert.Equal(Caio.Value, ofAna.MyVote!.CandidateMemberId);
        Assert.False(ofAna.CanVote);
        Assert.Equal(MvpBallotRefusal.AlreadyVoted, ofAna.Reason);
    }

    [Fact]
    public async Task TheBallot_ListsWhoPlayedButTheCaller_WithTheirSide()
    {
        var ballot = (await BallotAsync(Ana)).Value;

        Assert.Equal(MvpVotingState.Open, ballot.State);
        Assert.Equal(StartsAt.AddHours(6), ballot.OpensAt);
        Assert.Equal(StartsAt.AddHours(30), ballot.ClosesAt);
        Assert.Equal([Bia.Value, Caio.Value], ballot.Candidates.Select(candidate => candidate.MemberId));
        Assert.Equal(CourtSide.B, ballot.Candidates[0].MainSide);
    }

    [Fact]
    public async Task TheBallotOfWhoDidNotPlay_SaysWhy()
    {
        var ballot = (await BallotAsync(new MemberId(Guid.NewGuid()))).Value;

        Assert.False(ballot.CanVote);
        Assert.Equal(MvpBallotRefusal.NotPlayed, ballot.Reason);
    }

    [Fact]
    public async Task TheBallotBeforeTheEnd_IsNotOpen()
    {
        var early = new FixedTimeProvider(StartsAt.AddHours(1));

        var ballot = (await new GetMvpVotingHandler(Rounds(), votes, early).HandleAsync(GroupId, RoundId, Ana, TestContext.Current.CancellationToken)).Value;

        Assert.Equal(MvpVotingState.NotOpen, ballot.State);
        Assert.Equal(MvpBallotRefusal.NotOpen, ballot.Reason);
    }

    /// <summary>E9: a cancelled round is the very 404 of a round the group does not have.</summary>
    [Fact]
    public void E9_ACancelledRound_IsRoundNotFound()
    {
        Assert.Equal(RoundDirectoryErrors.RoundNotFound, ProjectedMvpVotingRounds.From(null).Error);
        Assert.Equal(RoundDirectoryErrors.RoundNotFound, ProjectedMvpVotingRounds.From(Projection(Voting, RoundState.Canceled)).Error);
    }

    [Fact]
    public void E10_TheVoteOffOnTheRound_OrTheMvpOff_IsVotingOff()
    {
        Assert.Equal(MvpVotingErrors.VotingOff, ProjectedMvpVotingRounds.From(Projection(Voting with { MvpVoting = false })).Error);
        Assert.Equal(MvpVotingErrors.VotingOff, ProjectedMvpVotingRounds.From(Projection(Voting with { MvpEnabled = false })).Error);
    }

    [Fact]
    public void AClosedRound_OpensTheVoteAtTheTap()
    {
        var closedAt = StartsAt.AddHours(2);

        var round = ProjectedMvpVotingRounds.From(Projection(Voting, RoundState.Scheduled, closedAt)).Value;

        Assert.Equal(closedAt, round.Ballot.Window.OpensAt);
    }

    private Task<Result<MyMvpVoteResponse>> CastAsync(MemberId voter, string? candidate) =>
        new CastMvpVoteHandler(Rounds(), votes, time, loggers.CreateLogger<CastMvpVoteHandler>())
            .HandleAsync(GroupId, RoundId, voter, candidate, TestContext.Current.CancellationToken);

    private Task<Result<MvpBallotResponse>> BallotAsync(MemberId caller) =>
        new GetMvpVotingHandler(Rounds(), votes, time).HandleAsync(GroupId, RoundId, caller, TestContext.Current.CancellationToken);

    private static FakeRounds Rounds() => new(ProjectedMvpVotingRounds.From(Projection(Voting)));

    private static RoundProjection Projection(SummaryRules rules, RoundState state = RoundState.Scheduled, DateTimeOffset? closedAt = null)
    {
        var facts = new RoundFacts(RoundId, state, StartsAt, DateOnly.FromDateTime(StartsAt.UtcDateTime), rules) { ClosedAt = closedAt };
        var summary = SessionSummary.Empty with
        {
            Players = [Player(Ana, 3, CourtSide.A), Player(Bia, 2, CourtSide.B), Player(Caio, 1, null)],
        };
        return new RoundProjection(facts, new CourtStreamHead(RoundId, Guid.NewGuid(), EventCount: 10), 10, "hash", summary);
    }

    private static PlayerSummary Player(MemberId member, int matches, CourtSide? side) =>
        new(member.Value, matches, Wins: 1, Losses: matches - 1, Undecided: 0, PointsFor: 0, PointsAgainst: 0, PlusMinus: 0,
            LongestWinStreak: 1, CurrentWinStreak: 0, [], new PointsByKindSummary(0, 0, 0, 0), side);

    private sealed class FakeRounds(Result<MvpVotingRound> round) : IMvpVotingRounds
    {
        public Task<Result<MvpVotingRound>> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken) =>
            Task.FromResult(groupId == GroupId && roundId == RoundId ? round : Result.Failure<MvpVotingRound>(RoundDirectoryErrors.RoundNotFound));
    }

    private sealed class FakeVotes : IMvpVoteStore
    {
        public List<MvpVote> Stored { get; } = [];

        public bool RefuseNext { get; set; }

        public Task<bool> TryCastAsync(Guid groupId, Guid roundId, MvpVote vote, CancellationToken cancellationToken)
        {
            if (RefuseNext || Stored.Any(stored => stored.Voter == vote.Voter))
            {
                RefuseNext = false;
                return Task.FromResult(false);
            }

            Stored.Add(vote);
            return Task.FromResult(true);
        }

        public Task<MvpVote?> FindMineAsync(Guid groupId, Guid roundId, MemberId voter, CancellationToken cancellationToken) =>
            Task.FromResult(Stored.FirstOrDefault(vote => vote.Voter == voter));

        public Task<IReadOnlyList<MvpVote>> ListForRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MvpVote>>(Stored);

        public Task<IReadOnlyList<GivenMvpVote>> ListGivenAsync(Guid groupId, MemberId voter, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<GivenMvpVote>>([.. Stored.Where(vote => vote.Voter == voter).Select(vote => new GivenMvpVote(RoundId, vote.Candidate, vote.CastAt))]);
    }
}
