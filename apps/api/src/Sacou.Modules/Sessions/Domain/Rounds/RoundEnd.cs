namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>
/// When a round ended (ADR 0072, D1): the earlier of the tap on "Encerrar rodada" and the automatic end,
/// <see cref="SessionLimits.RoundAutoEndHours"/> after the start. An instant calculation, so a change of hour does not move it.
/// </summary>
internal static class RoundEnd
{
    public static DateTimeOffset Of(DateTimeOffset startsAt, DateTimeOffset? closedAt)
    {
        var automatic = startsAt.AddHours(SessionLimits.RoundAutoEndHours);
        return closedAt is { } tapped && tapped < automatic ? tapped : automatic;
    }
}
