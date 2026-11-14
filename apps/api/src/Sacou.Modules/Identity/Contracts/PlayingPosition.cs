namespace Sacou.Modules.Identity.Contracts;

/// <summary>Mirrors the domain position, converted by hand: the domain enum stays internal (ADR 0051, D6).</summary>
public enum PlayingPosition
{
    Setter,
    OutsideHitter,
    Opposite,
    MiddleBlocker,
    Libero,
}

/// <summary>The main position: one of the five, or <see cref="Any"/> ("Qualquer uma").</summary>
public enum PrimaryPosition
{
    Any,
    Setter,
    OutsideHitter,
    Opposite,
    MiddleBlocker,
    Libero,
}
