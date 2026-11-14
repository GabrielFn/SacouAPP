using Sacou.Shared.Results;

namespace Sacou.Shared.Levels;

/// <summary>
/// A volleyball level on the 1 to 5 scale, in half points (glossary: "Nível, 1–5, privado"), kept as whole
/// tenths: 10, 15, ..., 50, as the <c>levelTenths</c> of docs/dominio/player-card.md. The player's suggestion
/// (Identity) and the admin's note (Groups) share it, so neither converts (ADR 0051, D4). Private by rule: only
/// the routes of ADR 0051, D7, ever write it to a response.
/// </summary>
public sealed record SkillLevel
{
    public const int MinTenths = 10;
    public const int MaxTenths = 50;
    public const int StepTenths = 5;
    public const int DefaultTenths = 30;

    private const decimal TenthsPerPoint = 10m;

    /// <summary>
    /// What a value off the scale gives. A module never sends it to HTTP: it answers its own code
    /// (<c>identity.profile-invalid</c>, <c>groups.level-invalid</c>).
    /// </summary>
    public static readonly Error OutOfScale = new("level.out-of-scale", ErrorKind.Validation);

    private SkillLevel(int tenths) => Tenths = tenths;

    /// <summary>3,0: the level of whoever has neither a note nor a suggestion.</summary>
    public static SkillLevel Default => new(DefaultTenths);

    public int Tenths { get; }

    public static Result<SkillLevel> FromTenths(int tenths) =>
        tenths is >= MinTenths and <= MaxTenths && tenths % StepTenths == 0
            ? Result.Success(new SkillLevel(tenths))
            : Result.Failure<SkillLevel>(OutOfScale);

    /// <summary>
    /// The number on the wire (<c>4.5</c>). Range first, so a huge value never overflows the scaling; then a
    /// whole number of tenths, so 4.25 is refused, never rounded.
    /// </summary>
    public static Result<SkillLevel> FromDecimal(decimal value)
    {
        if (value < MinTenths / TenthsPerPoint || value > MaxTenths / TenthsPerPoint)
        {
            return Result.Failure<SkillLevel>(OutOfScale);
        }

        var tenths = value * TenthsPerPoint;
        return tenths == decimal.Truncate(tenths) ? FromTenths((int)tenths) : Result.Failure<SkillLevel>(OutOfScale);
    }

    /// <summary>One decimal place at most: 45 tenths are 4.5, 30 are 3.</summary>
    public decimal ToDecimal() => Tenths / TenthsPerPoint;
}
