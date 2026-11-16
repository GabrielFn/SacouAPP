using System.Globalization;
using System.Security.Claims;
using Microsoft.Extensions.Logging.Abstractions;
using Sacou.Modules.Identity.Authentication;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.DeleteMyAccount;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Modules.Identity.Tests.Http;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.AccountData;

/// <summary>The steps of <c>DELETE /v1/me</c> (E3.16, ADR 0056, D4 and D7), with the modules and the stores faked.</summary>
public sealed class DeleteMyAccountHandlerTests
{
    private const string Uid = "uid-to-delete";

    private static readonly DateTimeOffset Now = new(2026, 11, 16, 12, 0, 0, TimeSpan.Zero);

    private readonly InMemoryUserStore users = new();

    [Fact]
    public async Task RecentLogin_ErasesChecksThenDeletesThenSweeps()
    {
        var user = await RegisterAsync();
        var erasure = new ScriptedErasure();

        var deletion = await HandleAsync(Principal(Now.AddMinutes(-5)), erasure);

        Assert.Null(deletion.Error);
        Assert.Equal([(user.Value, ErasureMode.Checked), (user.Value, ErasureMode.Sweep)], erasure.Calls);
        Assert.Equal([Uid], users.DeletedSubjects);
        Assert.Empty(users.Subjects);
    }

    [Theory]
    [InlineData(301)]
    [InlineData(600)]
    public async Task OldLogin_IsRefused_AndNothingIsTouched(int secondsAgo)
    {
        await RegisterAsync();
        var erasure = new ScriptedErasure();

        var deletion = await HandleAsync(Principal(Now.AddSeconds(-secondsAgo)), erasure);

        Assert.Equal("identity.recent-login-required", deletion.Error?.Code);
        Assert.Empty(erasure.Calls);
        Assert.Equal([Uid], users.Subjects);
    }

    [Fact]
    public async Task PrincipalWithoutAuthTime_IsRefusedAsAnOldLogin()
    {
        await RegisterAsync();
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Uid)], "Test"));

        var deletion = await HandleAsync(principal, new ScriptedErasure());

        Assert.Equal("identity.recent-login-required", deletion.Error?.Code);
    }

    [Fact]
    public async Task Blocked_ReturnsTheGroups_AndDeletesNothing()
    {
        await RegisterAsync();
        var groups = new[] { Guid.CreateVersion7(), Guid.CreateVersion7() };
        var erasure = new ScriptedErasure(blocking: [groups[1], groups[0]]);

        var deletion = await HandleAsync(Principal(Now), erasure);

        Assert.Equal("identity.deletion-blocked", deletion.Error?.Code);
        Assert.Equal(groups.Order(), deletion.BlockingGroupIds);
        Assert.Single(erasure.Calls);
        Assert.Empty(users.DeletedSubjects);
        Assert.Equal([Uid], users.Subjects);
    }

    /// <summary>D4 of the plan: deleting again, or a login that never signed in, is a success that asks no module.</summary>
    [Fact]
    public async Task Unregistered_IsDeletedAlready()
    {
        var erasure = new ScriptedErasure();

        var deletion = await HandleAsync(Principal(Now), erasure);

        Assert.Null(deletion.Error);
        Assert.Empty(erasure.Calls);
    }

    /// <summary>D6 of the plan: a failure after the Groups step is cured by the next call, which runs every step again.</summary>
    [Fact]
    public async Task FailureInTheMiddle_IsCuredByCallingAgain()
    {
        var user = await RegisterAsync();
        var failing = new FailingTombstones(users);
        var erasure = new ScriptedErasure();

        await Assert.ThrowsAsync<InvalidOperationException>(() => HandleAsync(Principal(Now), erasure, failing));
        Assert.Equal([Uid], users.Subjects);

        var deletion = await HandleAsync(Principal(Now), erasure);

        Assert.Null(deletion.Error);
        Assert.Equal([ErasureMode.Checked, ErasureMode.Checked, ErasureMode.Sweep], erasure.Calls.Select(call => call.Mode));
        Assert.All(erasure.Calls, call => Assert.Equal(user.Value, call.UserId));
        Assert.Empty(users.Subjects);
    }

    private async Task<UserId> RegisterAsync()
    {
        var user = User.Create(AuthSubject.Create(Uid).Value, Now);
        Assert.True(await users.TryCreateAsync(user, TestContext.Current.CancellationToken));
        return user.Id;
    }

    private Task<AccountDeletion> HandleAsync(ClaimsPrincipal principal, ScriptedErasure erasure, IDeletedAccountStore? tombstones = null) =>
        new DeleteMyAccountHandler(users, tombstones ?? users, [erasure], new FixedTimeProvider(Now), NullLogger<DeleteMyAccountHandler>.Instance)
            .HandleAsync(principal, TestContext.Current.CancellationToken);

    private static ClaimsPrincipal Principal(DateTimeOffset authenticatedAt) => new(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.NameIdentifier, Uid),
            new Claim(LoginClaims.AuthenticatedAt, authenticatedAt.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)),
        ],
        "Test"));

    private sealed class ScriptedErasure(IReadOnlyList<Guid>? blocking = null) : IAccountErasure
    {
        public List<(Guid UserId, ErasureMode Mode)> Calls { get; } = [];

        public Task<IReadOnlyList<Guid>> EraseAsync(Guid userId, ErasureMode mode, CancellationToken cancellationToken)
        {
            Calls.Add((userId, mode));
            return Task.FromResult(mode == ErasureMode.Checked ? blocking ?? [] : (IReadOnlyList<Guid>)[]);
        }
    }

    private sealed class FailingTombstones(InMemoryUserStore inner) : IDeletedAccountStore
    {
        public Task<bool> IsDeletedAsync(AuthSubject subject, CancellationToken cancellationToken) => inner.IsDeletedAsync(subject, cancellationToken);

        public Task DeleteAsync(UserId user, AuthSubject subject, DateTimeOffset now, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("The database went away.");
    }
}
