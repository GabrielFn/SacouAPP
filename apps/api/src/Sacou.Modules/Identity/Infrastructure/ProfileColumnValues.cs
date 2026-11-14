using System.Collections.Immutable;
using Sacou.Modules.Identity.Domain.Profiles;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// The text of each position in the database, written by hand so reordering or renaming an enum never changes
/// stored data. The CHECK constraints are built from the same lists (ADR 0051, D1).
/// </summary>
internal static class ProfileColumnValues
{
    public static readonly ImmutableDictionary<PlayingPosition, string> Positions = ImmutableDictionary<PlayingPosition, string>.Empty
        .Add(PlayingPosition.Setter, "setter")
        .Add(PlayingPosition.OutsideHitter, "outside_hitter")
        .Add(PlayingPosition.Opposite, "opposite")
        .Add(PlayingPosition.MiddleBlocker, "middle_blocker")
        .Add(PlayingPosition.Libero, "libero");

    public static readonly ImmutableDictionary<PrimaryPosition, string> PrimaryPositions = ImmutableDictionary<PrimaryPosition, string>.Empty
        .Add(PrimaryPosition.Any, "any")
        .Add(PrimaryPosition.Setter, Positions[PlayingPosition.Setter])
        .Add(PrimaryPosition.OutsideHitter, Positions[PlayingPosition.OutsideHitter])
        .Add(PrimaryPosition.Opposite, Positions[PlayingPosition.Opposite])
        .Add(PrimaryPosition.MiddleBlocker, Positions[PlayingPosition.MiddleBlocker])
        .Add(PrimaryPosition.Libero, Positions[PlayingPosition.Libero]);

    public static TEnum Parse<TEnum>(ImmutableDictionary<TEnum, string> values, string text)
        where TEnum : struct, Enum =>
        values.Single(pair => pair.Value == text).Key;

    /// <summary>The quoted SQL list, such as <c>'any', 'libero'</c>, in a fixed order.</summary>
    public static string SqlList(IEnumerable<string> values) =>
        string.Join(", ", values.Order(StringComparer.Ordinal).Select(value => $"'{value}'"));
}
