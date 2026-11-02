using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

/// <summary>One of the six court zones, numbered as in the official rules.</summary>
internal sealed record RotationSlot
{
    public static readonly RotationSlot One = new(1);
    public static readonly RotationSlot Two = new(2);
    public static readonly RotationSlot Three = new(3);
    public static readonly RotationSlot Four = new(4);
    public static readonly RotationSlot Five = new(5);
    public static readonly RotationSlot Six = new(6);

    public static readonly ImmutableArray<RotationSlot> All = [One, Two, Three, Four, Five, Six];

    private RotationSlot(int value) => Value = value;

    public int Value { get; }

    /// <summary>An unknown number here is a programming error, not a business failure.</summary>
    public static RotationSlot From(int value) =>
        All.FirstOrDefault(slot => slot.Value == value)
            ?? throw new ArgumentOutOfRangeException(nameof(value), value, "Not a rotation slot.");
}
