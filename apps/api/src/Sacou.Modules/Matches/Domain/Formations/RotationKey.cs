using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.Formations;

/// <summary>The setterZone that names a rotation. <see cref="Zero"/> is the single rotation of the Livre system, which has no setter.</summary>
internal sealed record RotationKey
{
    public static readonly RotationKey Zero = new(0);
    public static readonly RotationKey One = new(1);
    public static readonly RotationKey Two = new(2);
    public static readonly RotationKey Three = new(3);
    public static readonly RotationKey Four = new(4);
    public static readonly RotationKey Five = new(5);
    public static readonly RotationKey Six = new(6);

    public static readonly ImmutableArray<RotationKey> All = [Zero, One, Two, Three, Four, Five, Six];

    private RotationKey(int value) => Value = value;

    public int Value { get; }

    /// <summary>An unknown number here is a programming error, not a business failure.</summary>
    public static RotationKey From(int value) =>
        All.FirstOrDefault(key => key.Value == value)
            ?? throw new ArgumentOutOfRangeException(nameof(value), value, "Not a rotation key.");
}
