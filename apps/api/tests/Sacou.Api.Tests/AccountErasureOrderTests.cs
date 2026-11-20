using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Identity.Contracts;
using Xunit;

namespace Sacou.Api.Tests;

/// <summary>
/// The Notifications erase the notifications of the person's member ids, which the Groups' erasure unlinks from the
/// account: the Notifications' erasure must run first (ADR 0069, D9). The order is the registration order in Program.cs.
/// </summary>
public sealed class AccountErasureOrderTests(SacouApiFactory factory) : IClassFixture<SacouApiFactory>
{
    [Fact]
    public async Task NotificationsErasure_RunsBeforeTheGroupsOne()
    {
        var scope = factory.Services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var erasures = scope.ServiceProvider.GetServices<IAccountErasure>().Select(erasure => erasure.GetType().Name).ToList();

            Assert.Equal(["NotificationsAccountErasure", "GroupsAccountErasure"], erasures);
        }
    }
}
