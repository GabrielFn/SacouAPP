namespace Sacou.Modules.Identity.Domain.Profiles;

/// <summary>
/// Where a person likes to play (glossary: <c>PlayingPosition</c>). Not <c>RotationSlot</c> nor <c>CourtPoint</c>:
/// those are places on the court. The order of the values is the canonical order of the other positions.
/// </summary>
internal enum PlayingPosition
{
    Setter,
    OutsideHitter,
    Opposite,
    MiddleBlocker,
    Libero,
}

/// <summary>The main position: one of the five, or <see cref="Any"/> ("Qualquer uma", screen 27).</summary>
internal enum PrimaryPosition
{
    Any,
    Setter,
    OutsideHitter,
    Opposite,
    MiddleBlocker,
    Libero,
}
