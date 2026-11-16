using Sacou.Modules.Sessions.Domain.Draw;
using Sacou.Modules.Sessions.DrawTeams;
using Xunit;

namespace Sacou.Modules.Sessions.Tests.Draw;

/// <summary>The body of the draw route to the domain: absent lists are "no locks" and "the last to arrive".</summary>
public sealed class DrawTeamsRequestTests
{
    [Fact]
    public void AbsentLists_AreNoLocks_AndTheDefaultReserves()
    {
        var request = new DrawTeamsRequest(null, null);

        Assert.Empty(request.ToLocks().Value);
        Assert.Null(request.ToReserves());
    }

    [Fact]
    public void Locks_AndReserves_KeepTheirOrderAndKind()
    {
        var first = DrawFixture.Member(1);
        var second = DrawFixture.Member(2);
        var request = new DrawTeamsRequest([new DrawLockRequest(first.Value, second.Value, DrawLockKind.Apart)], [second.Value, first.Value]);

        Assert.Equal([DrawFixture.Apart(first, second)], request.ToLocks().Value);
        Assert.Equal([second, first], request.ToReserves()!.Value);
    }

    [Fact]
    public void ANullLock_IsLockInvalid()
    {
        var request = new DrawTeamsRequest([null], null);

        Assert.Equal(DrawErrors.LockInvalid, request.ToLocks().Error);
    }
}
