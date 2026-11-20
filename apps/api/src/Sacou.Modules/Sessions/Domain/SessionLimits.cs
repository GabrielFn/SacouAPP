namespace Sacou.Modules.Sessions.Domain;

/// <summary>Ceilings against a flood of rounds and series, and the text limits (ADR 0043, D10).</summary>
internal static class SessionLimits
{
    public const int MaxUpcomingRoundsPerGroup = 20;
    public const int MaxActiveSeriesPerGroup = 7;
    public const int MaxDaysAhead = 365;
    public const int MaxVenueLength = 80;
    public const int MaxVenueCodePoints = 320;
    public const int MaxMarksPerCharacter = 4;
    public const int MaxSettingsLayerBytes = 4096;

    /// <summary>A round nobody closed ends this long after its start (ADR 0072, D1, question 140).</summary>
    public const int RoundAutoEndHours = 6;
}
