using System.Reflection;
using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.AppendCourtEvents;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Modules.Matches.ListCourtEvents;
using Sacou.Modules.Matches.TakeOverCourt;
using Sacou.Modules.Sessions.Contracts;
using Xunit;

namespace Sacou.Modules.Matches.Tests.TakeOverCourt;

/// <summary>The takeover handler with fake collaborators: the role asked again under the lock, the body before the store, the 409 extensions.</summary>
public sealed class TakeOverCourtHandlerTests
{
    private const string Device = "e0000000-0000-4000-8000-000000000001";
    private static readonly Guid GroupId = Guid.Parse("10000000-0000-4000-8000-000000000001");
    private static readonly Guid UserId = Guid.Parse("20000000-0000-4000-8000-000000000002");
    private static readonly Guid MemberId = Guid.Parse("30000000-0000-4000-8000-000000000003");
    private static readonly CourtRoute Route = new(Guid.NewGuid(), Guid.NewGuid());
    private static readonly byte[] ValidBody = Encoding.UTF8.GetBytes($$"""{"deviceId":"{{Device}}","expectedBatch":1,"expectedEventCount":0}""");

    private static CourtAccess Access(GroupRole role = GroupRole.Scorekeeper) => new(GroupId, UserId, MemberId, role);

    private static TakeOverCourtHandler Handler(FakeRounds rounds, FakeMembership membership, FakeStore store) =>
        new(rounds, membership, store, TimeProvider.System, NullLogger<TakeOverCourtHandler>.Instance);

    [Fact]
    public async Task AnInvalidBody_NeverReachesTheStore()
    {
        var store = new FakeStore();

        var result = await Handler(new FakeRounds(), new FakeMembership(), store).HandleAsync(Access(), Route, "{}"u8.ToArray(), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(0, store.Calls);
    }

    [Fact]
    public async Task ARoundThatDoesNotExist_NeverReachesTheStore()
    {
        var store = new FakeStore();

        var result = await Handler(new FakeRounds { Round = null }, new FakeMembership(), store).HandleAsync(Access(), Route, ValidBody, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(RoundDirectoryErrors.RoundNotFound, result.Error.Error);
        Assert.Equal(0, store.Calls);
    }

    [Fact]
    public async Task ACanceledRound_IsTakenOverToo()
    {
        var store = new FakeStore();

        await Handler(new FakeRounds { Round = new RoundSummary(RoundState.Canceled) }, new FakeMembership(), store)
            .HandleAsync(Access(), Route, ValidBody, CancellationToken.None);

        Assert.Equal(1, store.Calls);
    }

    [Theory]
    [InlineData(GroupRole.Admin, true)]
    [InlineData(GroupRole.CoAdmin, true)]
    [InlineData(GroupRole.Scorekeeper, true)]
    [InlineData(GroupRole.Player, false)]
    public async Task UnderTheLock_TheRoleIsAskedAgain(GroupRole currentRole, bool mayStillWrite)
    {
        var store = new FakeStore();
        var membership = new FakeMembership { Current = new GroupMembership(MemberId, currentRole, MemberType.Regular) };

        await Handler(new FakeRounds(), membership, store).HandleAsync(Access(GroupRole.Scorekeeper), Route, ValidBody, CancellationToken.None);

        Assert.Equal(mayStillWrite, store.StillMayWrite);
    }

    [Fact]
    public async Task UnderTheLock_ALeftMember_OrAnotherMemberOfTheUser_DoesNotTakeOver()
    {
        var left = new FakeStore();
        await Handler(new FakeRounds(), new FakeMembership { Current = null }, left).HandleAsync(Access(), Route, ValidBody, CancellationToken.None);
        var another = new FakeStore();
        var anotherMember = new FakeMembership { Current = new GroupMembership(Guid.NewGuid(), GroupRole.Admin, MemberType.Regular) };
        await Handler(new FakeRounds(), anotherMember, another).HandleAsync(Access(), Route, ValidBody, CancellationToken.None);

        Assert.False(left.StillMayWrite);
        Assert.False(another.StillMayWrite);
    }

    [Fact]
    public void AStreamChanged_AndANeverWroteNotTheWriter_CarryNoLastSequence()
    {
        var changed = CourtProblems.From(new CourtWriteError(CourtWriteErrorCode.StreamChanged));
        var neverWrote = CourtProblems.From(new CourtWriteError(CourtWriteErrorCode.NotTheWriter, CurrentBatch: 2, LastSequence: null));

        Assert.False(changed.Extensions.ContainsKey(CourtProblem.LastSequenceExtension));
        Assert.False(neverWrote.Extensions.ContainsKey(CourtProblem.LastSequenceExtension));
        Assert.Equal(2L, neverWrote.Extensions[CourtProblem.CurrentBatchExtension]);
    }

    [Fact]
    public void ALastSequenceOfZero_IsStillAnswered_WhenThePairWroteAnEarlierBatch()
    {
        var problem = CourtProblems.From(new CourtWriteError(CourtWriteErrorCode.NotTheWriter, CurrentBatch: 2, LastSequence: 0));

        Assert.Equal(0L, problem.Extensions[CourtProblem.LastSequenceExtension]);
    }

    [Theory]
    [InlineData(null, 0L)]
    [InlineData("0", 0L)]
    [InlineData("7", 7L)]
    [InlineData("9223372036854775807", long.MaxValue)]
    public void TheAfterQuery_ThatIsAnInteger_IsThePosition(string? after, long expected) =>
        Assert.Equal(expected, ParseAfter(after));

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("-1")]
    [InlineData("+1")]
    [InlineData(" 1")]
    [InlineData("1 ")]
    [InlineData("1.0")]
    [InlineData("1e2")]
    [InlineData("1,000")]
    [InlineData("0x10")]
    [InlineData("abc")]
    [InlineData("9223372036854775808")]
    [InlineData("١")]
    public void TheAfterQuery_ThatIsNotAnInteger_IsRefused(string after) =>
        Assert.Null(ParseAfter(after));

    private static long? ParseAfter(string? after)
    {
        var method = typeof(ListCourtEventsEndpoint).GetMethod("Position", BindingFlags.NonPublic | BindingFlags.Static)!;
        return (long?)method.Invoke(null, [after]);
    }

    private sealed class FakeRounds : IRoundDirectory
    {
        public RoundSummary? Round { get; init; } = new(RoundState.Scheduled);

        public Task<RoundSummary?> FindAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken) => Task.FromResult(Round);
    }

    private sealed class FakeMembership : IGroupMembership
    {
        public GroupMembership? Current { get; init; } = new(MemberId, GroupRole.Scorekeeper, MemberType.Regular);

        public Task<GroupMembership?> FindActiveAsync(Guid groupId, Guid userId, CancellationToken cancellationToken) => Task.FromResult(Current);

        public Task<IReadOnlyList<GroupMembership>> ListActiveAsync(Guid groupId, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<IReadOnlyList<Guid>> ListMemberIdsOfUserAsync(Guid userId, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<IReadOnlySet<Guid>> FindMembersOfGroupAsync(Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public bool Allows(GroupRole role, GroupCapability capability) => role != GroupRole.Player;
    }

    private sealed class FakeStore : ICourtStreamStore
    {
        public int Calls { get; private set; }

        public bool? StillMayWrite { get; private set; }

        public Task<CourtStreamOutcome<CourtWriteDecision>> AppendAsync(
            CourtAppend append, Func<StoredStream, Result<CourtWriteDecision, CourtWriteError>> decide, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public async Task<CourtStreamOutcome<CourtTakeoverDecision>> TakeOverAsync(
            CourtTakeoverCall call, Func<StoredStream, Result<CourtTakeoverDecision, CourtWriteError>> decide, CancellationToken cancellationToken)
        {
            Calls++;
            StillMayWrite = await call.StillMayWrite(cancellationToken);
            return CourtStreamOutcome<CourtTakeoverDecision>.Refused(CourtStreamRefusal.Forbidden);
        }
    }
}
