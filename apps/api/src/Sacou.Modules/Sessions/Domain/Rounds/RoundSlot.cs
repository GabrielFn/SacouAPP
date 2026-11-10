using Sacou.Modules.Sessions.Domain.Time;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>
/// When a round starts. The truth is the local date and time ("terça 20h30"); the instant is calculated from
/// them and recalculated when either changes (ADR 0043, D4). A time that does not exist locally is already
/// moved forward here.
/// </summary>
internal sealed record RoundSlot(DateOnly Date, TimeOnly Time, string TimeZoneId, DateTimeOffset StartsAt)
{
    /// <summary>A slot an admin asks for: in the future and at most a year ahead, by local date.</summary>
    public static Result<RoundSlot> Request(DateOnly date, TimeOnly time, DateTimeOffset now)
    {
        var slot = At(date, time);
        var lastDay = SessionsTime.LocalDateOf(now, SessionsTime.TimeZone).AddDays(SessionLimits.MaxDaysAhead);
        return slot.StartsAt > now && slot.Date <= lastDay
            ? Result.Success(slot)
            : Result.Failure<RoundSlot>(RoundErrors.RoundInvalid);
    }

    /// <summary>A slot with no window rule, for the occurrences a series makes.</summary>
    public static RoundSlot At(DateOnly date, TimeOnly time)
    {
        var moment = LocalTimeConverter.ToMoment(date, time, SessionsTime.TimeZone);
        return new RoundSlot(moment.Date, moment.Time, SessionsTime.TimeZoneId, moment.Instant);
    }

    /// <summary>The moment avulsos may start answering: an instant calculation, not a local-clock one, so a change of hour in between does not move it.</summary>
    public DateTimeOffset DropInOpensAt(int hoursBefore) => StartsAt.AddHours(-hoursBefore);
}
