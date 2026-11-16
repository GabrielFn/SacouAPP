using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Modules.Identity.SignIn;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.SignIn;

/// <summary>P8: find, insert, and find again when a concurrent first sign-in won.</summary>
public sealed class SignInHandlerTests
{
    private static readonly AuthSubject Subject = AuthSubject.Create("uid-1").Value;
    private static readonly UserId Existing = new(Guid.CreateVersion7());

    [Fact]
    public async Task NewSubject_IsCreated()
    {
        var store = new ScriptedStore(finds: [null], inserted: true);

        var outcome = await HandleAsync(store);

        Assert.True(outcome.Created);
        Assert.Equal(store.CreatedUser?.Id, outcome.UserId);
        Assert.Equal(Subject, store.CreatedUser?.Subject);
    }

    [Fact]
    public async Task KnownSubject_IsFoundWithoutInserting()
    {
        var store = new ScriptedStore(finds: [Existing], inserted: true);

        var outcome = await HandleAsync(store);

        Assert.False(outcome.Created);
        Assert.Equal(Existing, outcome.UserId);
        Assert.Null(store.CreatedUser);
    }

    [Fact]
    public async Task LostRace_ReturnsTheWinnerAsExisting()
    {
        var store = new ScriptedStore(finds: [null, Existing], inserted: false);

        var outcome = await HandleAsync(store);

        Assert.False(outcome.Created);
        Assert.Equal(Existing, outcome.UserId);
        Assert.Equal(2, store.Finds);
    }

    private static Task<SignInOutcome> HandleAsync(IUserStore store) =>
        new SignInHandler(store, new FixedTimeProvider(FixedTimeProvider.WholeSecondNow()))
            .HandleAsync(Subject, TestContext.Current.CancellationToken);

    private sealed class ScriptedStore(UserId?[] finds, bool inserted) : IUserStore
    {
        public int Finds { get; private set; }

        public User? CreatedUser { get; private set; }

        public Task<UserId?> FindIdAsync(AuthSubject subject, CancellationToken cancellationToken) =>
            Task.FromResult(finds[Finds++]);

        public Task<DateTimeOffset?> FindCreatedAtAsync(UserId user, CancellationToken cancellationToken) =>
            Task.FromResult<DateTimeOffset?>(null);

        public Task<bool> TryCreateAsync(User user, CancellationToken cancellationToken)
        {
            CreatedUser = inserted ? user : null;
            return Task.FromResult(inserted);
        }
    }
}
