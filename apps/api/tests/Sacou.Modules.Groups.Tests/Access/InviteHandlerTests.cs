using Microsoft.Extensions.Logging.Abstractions;
using Sacou.Modules.Groups.AcceptInvite;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.CreateInvite;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Infrastructure.InviteTokens;
using Sacou.Modules.Groups.PreviewInvite;
using Sacou.Modules.Groups.Tests.Domain;
using Sacou.Modules.Identity.Contracts;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Access;

/// <summary>
/// T1 and T3 of E3.2 at the handlers, without a database: the token comes from the injected generator, and a
/// malformed or missing token, or an unregistered caller, never reaches the store.
/// </summary>
public sealed class InviteHandlerTests
{
    private const string FixedToken = "fixed-token-from-the-fake-generator-0123456";

    private readonly FakeGroupStore store = new();
    private readonly FakeTokenGenerator tokens = new();
    private readonly TimeProvider time = new FixedClock(GroupBuilder.Now);
    private readonly GroupBuilder world = GroupBuilder.WithFounder();

    public InviteHandlerTests() => store.Locked = world.Group;

    [Fact]
    public async Task Create_ReturnsTheGeneratorsToken_AndKeepsOnlyItsHash()
    {
        var handler = new CreateInviteHandler(store, tokens, time);

        var created = await handler.HandleAsync(FounderAccess(), TestContext.Current.CancellationToken);

        Assert.Equal(FixedToken, created.Value.Token);
        Assert.Equal(1, tokens.Calls);
        var invite = Assert.Single(store.Locked!.Invites);
        Assert.Equal(created.Value.InviteId, invite.Id.Value);
        Assert.Equal(InviteTokenHasher.Hash(FixedToken), invite.TokenHash);
        Assert.Null(created.Value.ExpiresAt);
        Assert.DoesNotContain(FixedToken, created.Value.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task PreviewAndAccept_OfTheCreatedToken_Work()
    {
        var created = await new CreateInviteHandler(store, tokens, time).HandleAsync(FounderAccess(), TestContext.Current.CancellationToken);
        var person = Guid.NewGuid();

        var preview = await Preview(person).HandleAsync(created.Value.Token, TestContext.Current.CancellationToken);
        var accepted = await Accept(person).HandleAsync(created.Value.Token, TestContext.Current.CancellationToken);
        var again = await Accept(person).HandleAsync(created.Value.Token, TestContext.Current.CancellationToken);

        Assert.Equal(("Racha", 1, false), (preview.Value.GroupName, preview.Value.ActiveMembers, preview.Value.AlreadyMember));
        Assert.True(accepted.Value.Joined);
        Assert.False(again.Value.Joined);
        Assert.Equal(accepted.Value.MemberId, again.Value.MemberId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("fixed-token-from-the-fake-generator-01234567")]
    [InlineData("fixed+token/from=the-fake-generator-0123456")]
    public async Task MalformedToken_IsInvalid_WithoutTouchingTheStore(string? token)
    {
        var preview = await Preview(Guid.NewGuid()).HandleAsync(token, TestContext.Current.CancellationToken);
        var accepted = await Accept(Guid.NewGuid()).HandleAsync(token, TestContext.Current.CancellationToken);

        Assert.Equal(GroupErrors.InviteInvalid, preview.Error);
        Assert.Equal(GroupErrors.InviteInvalid, accepted.Error);
        Assert.Equal(0, store.InviteCalls);
    }

    [Fact]
    public async Task UnregisteredCaller_IsRefused_BeforeTheToken()
    {
        var preview = await new PreviewInviteHandler(new FakeCurrentUser(null), store, time).HandleAsync(FixedToken, TestContext.Current.CancellationToken);
        var accepted = await new AcceptInviteHandler(new FakeCurrentUser(null), new FakeRegisteredUsers(), store, time, NullLogger<AcceptInviteHandler>.Instance)
            .HandleAsync(FixedToken, TestContext.Current.CancellationToken);

        Assert.Equal(CurrentUserErrors.NotRegistered, preview.Error);
        Assert.Equal(CurrentUserErrors.NotRegistered, accepted.Error);
        Assert.Equal(0, store.InviteCalls);
    }

    /// <summary>ADR 0056, D7: the account was deleted after the request resolved the person; the store's check refuses it.</summary>
    [Fact]
    public async Task Accept_OfAnAccountDeletedMeanwhile_IsNotRegistered_AndJoinsNobody()
    {
        var created = await new CreateInviteHandler(store, tokens, time).HandleAsync(FounderAccess(), TestContext.Current.CancellationToken);
        var members = store.Locked!.Members.Length;

        var accepted = await Accept(Guid.NewGuid(), stillRegistered: false).HandleAsync(created.Value.Token, TestContext.Current.CancellationToken);

        Assert.Equal(CurrentUserErrors.NotRegistered, accepted.Error);
        Assert.Equal(members, store.Locked!.Members.Length);
    }

    private GroupAccess FounderAccess() => new(world.Group.Id, world.Founder, world.Founder.UserId!.Value);

    private PreviewInviteHandler Preview(Guid person) => new(new FakeCurrentUser(person), store, time);

    private AcceptInviteHandler Accept(Guid person, bool stillRegistered = true) =>
        new(new FakeCurrentUser(person), new FakeRegisteredUsers(stillRegistered), store, time, NullLogger<AcceptInviteHandler>.Instance);

    private sealed class FakeTokenGenerator : IInviteTokenGenerator
    {
        public int Calls { get; private set; }

        public string NewToken()
        {
            Calls++;
            return FixedToken;
        }
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
