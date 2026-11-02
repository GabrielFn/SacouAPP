using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.Formations;

namespace Sacou.Modules.Matches.Domain.Overlap;

/// <summary>An official relation between two neighbouring slots.</summary>
internal sealed record OverlapRelation
{
    public static readonly OverlapRelation OneBehindTwo = Depth("1-behind-2", RotationSlot.One, RotationSlot.Two);
    public static readonly OverlapRelation SixBehindThree = Depth("6-behind-3", RotationSlot.Six, RotationSlot.Three);
    public static readonly OverlapRelation FiveBehindFour = Depth("5-behind-4", RotationSlot.Five, RotationSlot.Four);
    public static readonly OverlapRelation FourLeftOfThree = Lateral("4-left-of-3", RotationSlot.Four, RotationSlot.Three);
    public static readonly OverlapRelation ThreeLeftOfTwo = Lateral("3-left-of-2", RotationSlot.Three, RotationSlot.Two);
    public static readonly OverlapRelation FiveLeftOfSix = Lateral("5-left-of-6", RotationSlot.Five, RotationSlot.Six);
    public static readonly OverlapRelation SixLeftOfOne = Lateral("6-left-of-1", RotationSlot.Six, RotationSlot.One);

    /// <summary>The fixed order of <c>checked</c> and <c>violations</c>.</summary>
    public static readonly ImmutableArray<OverlapRelation> All =
    [
        OneBehindTwo,
        SixBehindThree,
        FiveBehindFour,
        FourLeftOfThree,
        ThreeLeftOfTwo,
        FiveLeftOfSix,
        SixLeftOfOne,
    ];

    private readonly bool _isDepth;
    private readonly RotationSlot _first;
    private readonly RotationSlot _second;

    private OverlapRelation(string id, bool isDepth, RotationSlot first, RotationSlot second)
    {
        Id = id;
        _isDepth = isDepth;
        _first = first;
        _second = second;
    }

    public string Id { get; }

    public bool Involves(RotationSlot slot) => _first == slot || _second == slot;

    /// <summary>Both comparisons are false for NaN, so a bad coordinate fails instead of passing.</summary>
    public bool Holds(CourtPositions positions, double tolerance) =>
        _isDepth
            ? positions.At(_first).Y >= positions.At(_second).Y - tolerance
            : positions.At(_first).X <= positions.At(_second).X + tolerance;

    private static OverlapRelation Depth(string id, RotationSlot back, RotationSlot front) =>
        new(id, isDepth: true, back, front);

    private static OverlapRelation Lateral(string id, RotationSlot left, RotationSlot right) =>
        new(id, isDepth: false, left, right);
}
