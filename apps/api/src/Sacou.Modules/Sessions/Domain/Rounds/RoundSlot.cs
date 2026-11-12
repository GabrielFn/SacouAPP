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
    public static Result<RequestedSlot> Request(DateOnly date, TimeOnly time, DateTimeOffset now) =>
        RequestedSlot.From(At(date, time), now);

    /// <summary>A slot with no window rule, for the occurrences a series makes.</summary>
    public static RoundSlot At(DateOnly date, TimeOnly time)
    {
        var moment = LocalTimeConverter.ToMoment(date, time, SessionsTime.TimeZone);
        return new RoundSlot(moment.Date, moment.Time, SessionsTime.TimeZoneId, moment.Instant);
    }

    /// <summary>The moment avulsos may start answering: an instant calculation, not a local-clock one, so a change of hour in between does not move it.</summary>
    public DateTimeOffset DropInOpensAt(int hoursBefore) => StartsAt.AddHours(-hoursBefore);
}

/// <summary>
/// A <see cref="RoundSlot"/> that passed the window rule of an admin's request. It can only be made by
/// <see cref="RoundSlot.Request"/>, so an edit that takes one cannot be handed a slot that skipped the rule.
/// </summary>
internal sealed record RequestedSlot
{
    private RequestedSlot(RoundSlot slot) => Slot = slot;

    public RoundSlot Slot { get; }

    internal static Result<RequestedSlot> From(RoundSlot slot, DateTimeOffset now)
    {
        var lastDay = SessionsTime.LocalDateOf(now, SessionsTime.TimeZone).AddDays(SessionLimits.MaxDaysAhead);
        return slot.StartsAt > now && slot.Date <= lastDay
            ? Result.Success(new RequestedSlot(slot))
            : Result.Failure<RequestedSlot>(RoundErrors.RoundInvalid);
    }
}
