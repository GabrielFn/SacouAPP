using System.Net;
using Microsoft.AspNetCore.Http;
using Sacou.Http.RateLimiting;
using Xunit;

namespace Sacou.Http.Tests.RateLimiting;

/// <summary>The partition of the round page (ADR 0070, D6): the hash of the last forwarded address, never the address.</summary>
public sealed class ClientAddressKeyTests
{
    [Fact]
    public void ForgedHeader_CountsOnlyItsLastItem()
    {
        var forged = string.Join(", ", Enumerable.Range(1, 50).Select(item => $"10.0.0.{item}"));

        Assert.Equal(IPAddress.Parse("10.0.0.50"), ClientAddressKey.LastForwarded([forged]));
        Assert.Equal(Key("10.0.0.50"), Key(forged));
        Assert.Equal(Key("1.1.1.1, 2.2.2.2"), Key("2.2.2.2"));
    }

    [Fact]
    public void LastItemThatIsNoAddress_FallsBackToTheConnection()
    {
        Assert.Null(ClientAddressKey.LastForwarded(["10.0.0.1, not-an-address"]));
        Assert.Null(ClientAddressKey.LastForwarded([]));
        Assert.Equal(ClientAddressKey.Unknown, Key("10.0.0.1, not-an-address"));
    }

    [Fact]
    public void Key_IsAHash_AndNeverTheAddress()
    {
        var key = Key("203.0.113.7");

        Assert.Equal(64, key.Length);
        Assert.DoesNotContain("203.0.113.7", key, StringComparison.Ordinal);
        Assert.NotEqual(key, Key("203.0.113.8"));
    }

    [Fact]
    public void WithoutTheHeader_TheConnectionCounts()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("198.51.100.1");

        Assert.Equal(Key("198.51.100.1"), ClientAddressKey.Of(context));
    }

    private static string Key(string forwardedFor)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers[ClientAddressKey.ForwardedFor] = forwardedFor;
        return ClientAddressKey.Of(context);
    }
}
