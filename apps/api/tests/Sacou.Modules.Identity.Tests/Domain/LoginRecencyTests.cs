using Sacou.Modules.Identity.Domain.Accounts;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Domain;

/// <summary>U1 of E3.16 (ADR 0056, D4): five minutes included, a second more refused.</summary>
public sealed class LoginRecencyTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 16, 12, 0, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(0, true)]
    [InlineData(299, true)]
    [InlineData(300, true)]
    [InlineData(301, false)]
    [InlineData(600, false)]
    [InlineData(-60, true)]
    public void SecondsSinceTheSignIn_DecideTheRecency(int secondsAgo, bool recent)
    {
        Assert.Equal(recent, LoginRecency.IsRecent(Now.AddSeconds(-secondsAgo), Now));
    }

    [Fact]
    public void TheWindow_IsFiveMinutes()
    {
        Assert.Equal(TimeSpan.FromMinutes(5), AccountRules.RecentLoginWindow);
    }
}
