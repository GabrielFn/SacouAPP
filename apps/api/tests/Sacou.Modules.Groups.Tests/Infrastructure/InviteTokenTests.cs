using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Invites;
using Sacou.Modules.Groups.Infrastructure.InviteTokens;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Infrastructure;

/// <summary>T1 to T3 of E3.2: the token's randomness and shape, its hash, and the format checked before any query.</summary>
public sealed class InviteTokenTests
{
    private const int Samples = 10_000;

    /// <summary>"abc" in SHA-256, from FIPS 180-2: a fixed vector, so the hash can never silently become another function.</summary>
    private const string AbcSha256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    [Fact]
    public void Generator_MakesDistinctBase64UrlTokensOf43Characters()
    {
        var generator = new RandomInviteTokenGenerator();

        var tokens = Enumerable.Range(0, Samples).Select(_ => generator.NewToken()).ToList();

        Assert.All(tokens, token => Assert.True(InviteTokenFormat.IsValid(token), token));
        Assert.Equal(Samples, tokens.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal(43, InviteTokenFormat.Length);
    }

    /// <summary>Every position takes several values: not a fixed prefix, a counter or an id spelled out.</summary>
    [Fact]
    public void Generator_SpreadsEveryPosition()
    {
        var generator = new RandomInviteTokenGenerator();
        var tokens = Enumerable.Range(0, Samples).Select(_ => generator.NewToken()).ToList();

        Assert.All(Enumerable.Range(0, InviteTokenFormat.Length - 1), position =>
            Assert.True(tokens.Select(token => token[position]).Distinct().Count() > 32, $"position {position}"));
    }

    [Fact]
    public void Hash_IsSha256OfTheTokenText()
    {
        var hash = InviteTokenHasher.Hash("abc");

        Assert.Equal(InviteTokenHash.Length, hash.Bytes.Length);
        Assert.Equal(AbcSha256, Convert.ToHexStringLower(hash.Bytes.AsSpan()));
        Assert.Equal(hash, InviteTokenHasher.Hash("abc"));
        Assert.NotEqual(hash, InviteTokenHasher.Hash("abd"));
    }

    [Fact]
    public void Hash_NeverPrintsItself()
    {
        var hash = InviteTokenHasher.Hash(new RandomInviteTokenGenerator().NewToken());

        Assert.Equal(nameof(InviteTokenHash), hash.ToString());
        Assert.DoesNotContain(Convert.ToHexString(hash.Bytes.AsSpan()), $"{hash}", StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(42)]
    [InlineData(44)]
    public void Format_RefusesAnyOtherLength(int length)
    {
        Assert.False(InviteTokenFormat.IsValid(new string('A', length)));
        Assert.True(InviteTokenFormat.IsValid(new string('A', InviteTokenFormat.Length)));
    }

    [Theory]
    [InlineData('+')]
    [InlineData('/')]
    [InlineData('=')]
    [InlineData(' ')]
    [InlineData('é')]
    [InlineData('١')]
    [InlineData('\0')]
    public void Format_RefusesCharactersOutsideBase64Url(char character)
    {
        var token = new string('A', InviteTokenFormat.Length - 1) + character;

        Assert.False(InviteTokenFormat.IsValid(token));
        Assert.True(InviteTokenFormat.IsValid(new string('A', InviteTokenFormat.Length - 2) + "-_"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Format_RefusesNothing(string? token)
    {
        Assert.False(InviteTokenFormat.IsValid(token));
        Assert.Equal(GroupErrors.InviteInvalid, InviteTokenHasher.HashIfWellFormed(token).Error);
    }

    [Fact]
    public void HashOfAWrongSize_IsAProgrammingError()
    {
        Assert.Throws<ArgumentException>(() => InviteTokenHash.From(new byte[InviteTokenHash.Length - 1]));
    }
}
