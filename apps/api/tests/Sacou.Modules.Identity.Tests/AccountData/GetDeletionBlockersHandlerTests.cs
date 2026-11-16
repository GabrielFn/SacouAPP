using Microsoft.Extensions.Logging.Abstractions;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.GetDeletionBlockers;
using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Modules.Identity.Tests.AccountData;

/// <summary>The blockers of E3.16 (ADR 0056, D10): every source asked, the answers joined in a fixed order.</summary>
public sealed class GetDeletionBlockersHandlerTests
{
    private static readonly Guid Person = Guid.CreateVersion7();

    [Fact]
    public async Task Blockers_FromEverySource_AreOrderedByNameThenId()
    {
        var first = Guid.CreateVersion7();
        var second = Guid.CreateVersion7();
        var handler = Handler(
            new Source([new DeletionBlocker(second, "Vôlei", DeletionBlockerKind.LastAdmin)]),
            new Source([new DeletionBlocker(first, "Racha de terça", DeletionBlockerKind.LastAdmin), new DeletionBlocker(Guid.Empty, "Vôlei", DeletionBlockerKind.LastAdmin)]));

        var found = await handler.HandleAsync(TestContext.Current.CancellationToken);

        Assert.Equal([first, Guid.Empty, second], found.Value.Blockers.Select(blocker => blocker.GroupId));
    }

    [Fact]
    public async Task NothingBlocks_IsAnEmptyList()
    {
        var found = await Handler(new Source([])).HandleAsync(TestContext.Current.CancellationToken);

        Assert.Empty(found.Value.Blockers);
    }

    [Fact]
    public async Task Unregistered_IsRefused_AndNoSourceIsAsked()
    {
        var source = new Source([]);
        var handler = new GetDeletionBlockersHandler(
            new StubCurrentUser(Result.Failure<CurrentUser>(CurrentUserErrors.NotRegistered)), [source], NullLogger<GetDeletionBlockersHandler>.Instance);

        var found = await handler.HandleAsync(TestContext.Current.CancellationToken);

        Assert.Equal(CurrentUserErrors.NotRegistered, found.Error);
        Assert.Equal(0, source.Calls);
    }

    private static GetDeletionBlockersHandler Handler(params Source[] sources) =>
        new(new StubCurrentUser(Result.Success(new CurrentUser(Person))), sources, NullLogger<GetDeletionBlockersHandler>.Instance);

    private sealed class Source(IReadOnlyList<DeletionBlocker> blockers) : IAccountDeletionBlockers
    {
        public int Calls { get; private set; }

        public Task<IReadOnlyList<DeletionBlocker>> FindAsync(Guid userId, CancellationToken cancellationToken)
        {
            Calls++;
            Assert.Equal(Person, userId);
            return Task.FromResult(blockers);
        }
    }

    private sealed class StubCurrentUser(Result<CurrentUser> user) : ICurrentUser
    {
        public Task<Result<CurrentUser>> GetAsync(CancellationToken cancellationToken) => Task.FromResult(user);
    }
}
