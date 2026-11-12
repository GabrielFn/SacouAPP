using Sacou.Shared.Results;

namespace Sacou.Modules.Identity.Domain.Profiles;

/// <summary>
/// The main position and the others (ADR 0051, D6). No main position, or <see cref="PrimaryPosition.Any"/>,
/// means no others; otherwise the others are concrete, without repeats and without the main one, so at most
/// <see cref="MaxOtherPositions"/>. Kept in the canonical order of <see cref="PlayingPosition"/>, so the answer
/// never depends on the order sent.
/// </summary>
internal sealed record PlayerPositions
{
    public const int MaxOtherPositions = 4;

    private PlayerPositions(PrimaryPosition? primary, IReadOnlyList<PlayingPosition> others)
    {
        Primary = primary;
        Others = others;
    }

    public static PlayerPositions None { get; } = new(primary: null, []);

    public PrimaryPosition? Primary { get; }

    public IReadOnlyList<PlayingPosition> Others { get; }

    public static Result<PlayerPositions> Create(PrimaryPosition? primary, IReadOnlyCollection<PlayingPosition>? others)
    {
        if (others is null || !Allows(primary, others))
        {
            return Result.Failure<PlayerPositions>(ProfileErrors.ProfileInvalid);
        }

        return Result.Success(new PlayerPositions(primary, [.. others.Order()]));
    }

    /// <summary>A pair read back from the database: trusted, already checked by the CHECK constraints.</summary>
    internal static PlayerPositions FromStored(PrimaryPosition? primary, IReadOnlyList<PlayingPosition> others) => new(primary, others);

    /// <summary>The concrete twin of a main position, or null for none and for <see cref="PrimaryPosition.Any"/>.</summary>
    public static PlayingPosition? Concrete(PrimaryPosition? primary) => primary switch
    {
        null or PrimaryPosition.Any => null,
        PrimaryPosition.Setter => PlayingPosition.Setter,
        PrimaryPosition.OutsideHitter => PlayingPosition.OutsideHitter,
        PrimaryPosition.Opposite => PlayingPosition.Opposite,
        PrimaryPosition.MiddleBlocker => PlayingPosition.MiddleBlocker,
        PrimaryPosition.Libero => PlayingPosition.Libero,
        _ => throw new ArgumentOutOfRangeException(nameof(primary), primary, "Every main position needs a rule."),
    };

    private static bool Allows(PrimaryPosition? primary, IReadOnlyCollection<PlayingPosition> others)
    {
        if (others.Any(position => !Enum.IsDefined(position)))
        {
            return false;
        }

        var main = Concrete(primary);
        return main is null
            ? others.Count == 0
            : others.Count <= MaxOtherPositions && others.Distinct().Count() == others.Count && !others.Contains(main.Value);
    }
}
