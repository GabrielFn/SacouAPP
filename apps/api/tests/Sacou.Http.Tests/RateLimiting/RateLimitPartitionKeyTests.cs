using System.Security.Claims;
using Sacou.Http.RateLimiting;
using Xunit;

namespace Sacou.Http.Tests.RateLimiting;

/// <summary>Case 2 of the plan: the key is a hash of the subject, never the subject itself (ADR 0062, D1).</summary>
public sealed class RateLimitPartitionKeyTests
{
    private const string Subject = "firebase-uid-123";
    private const int Sha256HexLength = 64;

    [Fact]
    public void SameSubject_SameKey()
    {
        Assert.Equal(RateLimitPartitionKey.Of(SignedIn(Subject)), RateLimitPartitionKey.Of(SignedIn(Subject)));
    }

    [Fact]
    public void OtherSubject_OtherKey()
    {
        Assert.NotEqual(RateLimitPartitionKey.Of(SignedIn(Subject)), RateLimitPartitionKey.Of(SignedIn(Subject + "x")));
    }

    [Fact]
    public void Key_IsTheHexHash_NeverTheSubject()
    {
        var key = RateLimitPartitionKey.Of(SignedIn(Subject))!;

        Assert.Equal(Sha256HexLength, key.Length);
        Assert.DoesNotContain(Subject, key, StringComparison.Ordinal);
        Assert.Matches("^[0-9a-f]+$", key);
    }

    [Fact]
    public void NoUser_NoKey()
    {
        Assert.Null(RateLimitPartitionKey.Of(new ClaimsPrincipal(new ClaimsIdentity())));
        Assert.Null(RateLimitPartitionKey.Of(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Subject)]))));
        Assert.Null(RateLimitPartitionKey.Of(new ClaimsPrincipal(new ClaimsIdentity([], "Bearer"))));
    }

    internal static ClaimsPrincipal SignedIn(string subject) =>
        new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, subject)], "Bearer"));
}
