using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Time;

namespace Sacou.Modules.Sessions.Domain.Series;

/// <summary>
/// "Repetir toda semana": a weekday and a local time, in the one fixed zone (ADR 0043, D3 and D4). It keeps
/// no settings: each occurrence is born inheriting the group, and "só nesta rodada" is only that occurrence.
/// Editing a series is out of the MVP: stop it and create another.
/// </summary>
internal sealed record RoundSeries(
    SeriesId Id, GroupId GroupId, DayOfWeek Weekday, TimeOnly LocalTime, Venue Venue, string TimeZoneId, DateTimeOffset? StoppedAt)
{
    public bool IsActive => StoppedAt is null;

    /// <summary>The weekday comes from the date of the first round.</summary>
    public static RoundSeries Start(SeriesId id, GroupId group, DateOnly firstDate, TimeOnly time, Venue venue) =>
        new(id, group, firstDate.DayOfWeek, time, venue, SessionsTime.TimeZoneId, StoppedAt: null);

    /// <summary>Stopping twice is a success without effect; the occurrence already created stays.</summary>
    public RoundSeries Stop(DateTimeOffset now) => IsActive ? this with { StoppedAt = now } : this;

    /// <summary>An occurrence of this series on a date: no layer, the series' venue.</summary>
    public RoundChange Occur(RoundId id, DateOnly date) =>
        Round.Create(id, GroupId, Id, RoundSlot.At(date, LocalTime), Venue, settingsLayerJson: null);
}
