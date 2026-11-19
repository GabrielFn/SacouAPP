using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RoundLinks;
using Sacou.Shared.Results;
using Xunit;
using static Sacou.Modules.Sessions.Tests.RoundFixture;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>The link's exposure (E3.12, criteria 3 and 4): the share URL by role, and the ids only while the round is open.</summary>
public sealed class RoundLinkAccessTests
{
    private const string Origin = "https://sacou.example";
    private const string Code = "K7fQ2xAbCdEfGhIjKlMn-_";
    private static readonly Guid User = Guid.Parse("00000000-0000-0000-0000-0000000000c1");

    [Theory]
    [InlineData(GroupRole.Admin, true)]
    [InlineData(GroupRole.CoAdmin, true)]
    [InlineData(GroupRole.Scorekeeper, false)]
    [InlineData(GroupRole.Player, false)]
    public void ShareUrl_OnlyForAdminAndCoAdmin(GroupRole role, bool seen)
    {
        var links = Links(Origin);

        var url = links.For(NewRound().WithLinkCode(RoundLinkCode.TryParse(Code)!), role);

        Assert.Equal(seen ? $"{Origin}/r/{Code}" : null, url);
    }

    [Fact]
    public void ShareUrl_IsNull_WithoutABase_OrWithoutACode()
    {
        var coded = NewRound().WithLinkCode(RoundLinkCode.TryParse(Code)!);

        Assert.Null(Links(null).For(coded, GroupRole.Admin));
        Assert.Null(Links(Origin).For(NewRound(), GroupRole.Admin));
    }

    [Fact]
    public async Task Resolve_GivesTheIds_OnlyWhileOpen_AndNeverForAMalformedCode()
    {
        var round = NewRound().WithLinkCode(RoundLinkCode.TryParse(Code)!);
        var start = round.Slot.StartsAt;

        var before = await Resolve(round, start.AddTicks(-1), Code, member: true);
        var atStart = await Resolve(round, start, Code, member: true);
        var cancelled = await Resolve(round.Cancel().Round, start.AddDays(-1), Code, member: false);
        var malformed = await Resolve(round, start.AddDays(-1), Code + "x", member: true);

        Assert.True(before.Value.IsOpen);
        Assert.Equal(round.Id.Value, before.Value.RoundId);
        Assert.Equal(round.GroupId.Value, before.Value.GroupId);
        Assert.True(before.Value.IsMember);
        Assert.False(atStart.Value.IsOpen);
        Assert.Null(atStart.Value.GroupId);
        Assert.Null(atStart.Value.RoundId);
        Assert.False(cancelled.Value.IsOpen);
        Assert.Null(cancelled.Value.RoundId);
        Assert.False(cancelled.Value.IsMember);
        Assert.Equal(RoundErrors.RoundLinkInvalid, malformed.Error);
    }

    /// <summary>Came in through the link, then gone before the second read: the refusal still says the person joined.</summary>
    [Fact]
    public async Task Answer_RemovedRightAfterJoining_RefusesButSaysJoined()
    {
        var round = NewRound().WithLinkCode(RoundLinkCode.TryParse(Code)!);
        var membership = new Membership(isMember: null);
        var handler = new AnswerByRoundLinkHandler(
            new Caller(), new RoundLinkReader(new OneRound(round)), membership, new Joining(),
            null!, new FixedTime(round.Slot.StartsAt.AddDays(-1)), NullLogger<AnswerByRoundLinkHandler>.Instance);

        var attempt = await handler.HandleAsync(Code, AttendanceResponse.Going, TestContext.Current.CancellationToken);

        Assert.True(attempt.Joined);
        Assert.True(attempt.Answer.IsFailure);
        Assert.Equal(2, membership.Reads);
    }

    private sealed class Joining : IGroupJoining
    {
        public Task<Result<JoinedMember>> JoinAsDropInAsync(Guid groupId, Guid userId, CancellationToken cancellationToken) =>
            Task.FromResult(Result.Success(new JoinedMember(Guid.NewGuid(), Joined: true)));
    }

    private static RoundShareLinks Links(string? origin) =>
        new(Options.Create(new RoundPageOptions { PublicBaseUrl = origin }), new Membership(null));

    private static Task<Result<ResolvedRoundLinkResponse>> Resolve(Round round, DateTimeOffset now, string code, bool member) =>
        new ResolveRoundLinkHandler(new Caller(), new RoundLinkReader(new OneRound(round)), new Membership(member), new FixedTime(now))
            .HandleAsync(code, TestContext.Current.CancellationToken);

    private sealed class FixedTime(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class Caller : ICurrentUser
    {
        public Task<Result<CurrentUser>> GetAsync(CancellationToken cancellationToken) => Task.FromResult(Result.Success(new CurrentUser(User)));
    }

    private sealed class OneRound(Round round) : UnsupportedRoundStore
    {
        public override Task<Round?> FindByLinkCodeAsync(RoundLinkCode code, CancellationToken cancellationToken) =>
            Task.FromResult<Round?>(code.Value == round.LinkCode!.Value ? round : null);
    }

    private sealed class Membership(bool? isMember) : IGroupMembership
    {
        public int Reads { get; private set; }
        public Task<GroupMembership?> FindActiveAsync(Guid groupId, Guid userId, CancellationToken cancellationToken) =>
            Task.FromResult(++Reads > 0 && isMember == true ? new GroupMembership(Guid.NewGuid(), GroupRole.Player, MemberType.Regular) : null);

        public bool Allows(GroupRole role, GroupCapability capability) => role is GroupRole.Admin or GroupRole.CoAdmin;

        public Task<IReadOnlyList<GroupMembership>> ListActiveAsync(Guid groupId, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<IReadOnlyList<Guid>> ListMemberIdsOfUserAsync(Guid userId, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task<IReadOnlySet<Guid>> FindMembersOfGroupAsync(Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
