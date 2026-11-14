namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>
/// SplitMix64 (Steele, Lea and Flood, 2014), written here so a seed always gives the same draw: the sequence of
/// <see cref="System.Random"/> may change between .NET versions and would break the golden cases (ADR 0055).
/// Not for secrets: the route takes the seed from <c>RandomNumberGenerator</c> and the draw only spends it.
/// </summary>
internal sealed class SeededRandom(ulong seed)
{
    private const ulong GoldenGamma = 0x9E3779B97F4A7C15;
    private const ulong FirstMixer = 0xBF58476D1CE4E5B9;
    private const ulong SecondMixer = 0x94D049BB133111EB;
    private const int FirstShift = 30;
    private const int SecondShift = 27;
    private const int FinalShift = 31;

    private ulong _state = seed;

    public ulong NextUInt64()
    {
        unchecked
        {
            _state += GoldenGamma;
            var mixed = _state;
            mixed = (mixed ^ (mixed >> FirstShift)) * FirstMixer;
            mixed = (mixed ^ (mixed >> SecondShift)) * SecondMixer;
            return mixed ^ (mixed >> FinalShift);
        }
    }

    /// <summary>A uniform whole number in <c>[0, bound)</c>, without the bias of a bare remainder.</summary>
    public int NextBelow(int bound)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(bound);
        var range = (ulong)bound;
        var unbiasedLimit = ulong.MaxValue - ((ulong.MaxValue % range) + 1) % range;
        ulong value;
        do
        {
            value = NextUInt64();
        }
        while (value > unbiasedLimit);

        return (int)(value % range);
    }

    /// <summary>Fisher-Yates: every order of the items is equally likely.</summary>
    public T[] Shuffle<T>(IReadOnlyList<T> items)
    {
        ArgumentNullException.ThrowIfNull(items);
        var shuffled = items.ToArray();
        for (var last = shuffled.Length - 1; last > 0; last--)
        {
            var other = NextBelow(last + 1);
            (shuffled[last], shuffled[other]) = (shuffled[other], shuffled[last]);
        }

        return shuffled;
    }
}
