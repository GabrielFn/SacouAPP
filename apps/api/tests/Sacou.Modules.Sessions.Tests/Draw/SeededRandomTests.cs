using Sacou.Modules.Sessions.Domain.Draw;
using Xunit;

namespace Sacou.Modules.Sessions.Tests.Draw;

public sealed class SeededRandomTests
{
    /// <summary>The reference outputs of SplitMix64 (Steele, Lea and Flood), first three of each seed.</summary>
    public static readonly TheoryData<ulong, ulong[]> KnownVectors = new()
    {
        { 0UL, [0xE220A8397B1DCDAF, 0x6E789E6AA1B965F4, 0x06C45D188009454F] },
        { 1UL, [0x910A2DEC89025CC1, 0xBEEB8DA1658EEC67, 0xF893A2EEFB32555E] },
    };

    [Theory]
    [MemberData(nameof(KnownVectors))]
    public void NextUInt64_GivesTheKnownSequence(ulong seed, ulong[] expected)
    {
        var random = new SeededRandom(seed);
        ulong[] actual = [random.NextUInt64(), random.NextUInt64(), random.NextUInt64()];

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void NextBelow_StaysInRangeAndReachesEveryValue()
    {
        const int Bound = 7;
        const int Draws = 2000;
        var random = new SeededRandom(DrawFixture.Seed);

        var values = Enumerable.Range(0, Draws).Select(_ => random.NextBelow(Bound)).ToHashSet();

        Assert.Equal(Enumerable.Range(0, Bound).ToHashSet(), values);
    }

    [Fact]
    public void NextBelow_RefusesAnEmptyRange()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new SeededRandom(DrawFixture.Seed).NextBelow(0));
    }

    [Fact]
    public void Shuffle_IsAPermutationAndRepeatsWithTheSeed()
    {
        int[] items = [.. Enumerable.Range(1, 20)];

        var first = new SeededRandom(DrawFixture.Seed).Shuffle(items);
        var second = new SeededRandom(DrawFixture.Seed).Shuffle(items);

        Assert.Equal(items, first.Order());
        Assert.Equal(first, second);
        Assert.NotEqual(items, first);
    }
}
