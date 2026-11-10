using System.Globalization;
using System.Text.Json.Nodes;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Application;

/// <summary>
/// The round as the screens read it (tela 06 and 21). Only ids, types and numbers: no name, no
/// <c>userId</c>, no e-mail. Names come from the profile of E3.17, by <c>memberId</c>.
/// </summary>
internal sealed record RoundResponse(
    Guid RoundId,
    Guid? SeriesId,
    string LocalDate,
    string LocalTime,
    string TimeZone,
    DateTimeOffset StartsAt,
    DateTimeOffset? DropInOpensAt,
    string Venue,
    RoundStatus Status,
    RoundSettingsResponse Settings,
    int? Capacity,
    int GoingCount,
    int WaitlistCount,
    IReadOnlyList<GoingEntry> Going,
    IReadOnlyList<WaitlistEntry> Waitlist,
    MeResponse Me)
{
    public static RoundResponse From(Round round, ResolvedRound resolved, RoundGroupState group, MemberId me)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentNullException.ThrowIfNull(resolved);
        ArgumentNullException.ThrowIfNull(group);
        var rules = resolved.Rules;
        return new RoundResponse(
            round.Id.Value,
            round.SeriesId?.Value,
            RoundFormat.Date(round.Slot.Date),
            RoundFormat.Time(round.Slot.Time),
            round.Slot.TimeZoneId,
            round.Slot.StartsAt,
            rules.DropInWindowEnabled ? round.Slot.DropInOpensAt(rules.DropInOpensHoursBefore) : null,
            round.Venue.Value,
            round.Status,
            RoundSettingsResponse.From(resolved.Settings),
            rules.CapacityLimited ? rules.Capacity : null,
            round.SpotsHeld,
            round.Waitlist.Length,
            [.. round.Occupants.Select((attendance, index) => new GoingEntry(
                attendance.Member.Value, TypeOf(group, attendance.Member), attendance.Source, index + 1, attendance.Status == AttendanceStatus.Promoted))],
            [.. round.Waitlist.Select((attendance, index) => new WaitlistEntry(attendance.Member.Value, TypeOf(group, attendance.Member), index + 1))],
            MeResponse.From(round, me));
    }

    /// <summary>Whoever left the group is dropped by the reconcile that runs before this; the fallback only keeps a race from failing the read.</summary>
    private static MemberType TypeOf(RoundGroupState group, MemberId member) => group.TypeOf(member) ?? MemberType.DropIn;
}

/// <summary><c>layer</c> is what the round stores (null when it inherits all), <c>resolved</c> the complete document, <c>sources</c> the origin of each leaf.</summary>
internal sealed record RoundSettingsResponse(
    int SchemaVersion, JsonNode? Layer, JsonNode? Resolved, IReadOnlyDictionary<string, string> Sources)
{
    private const string SchemaVersionKey = "schemaVersion";

    public static RoundSettingsResponse From(RoundSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);
        var resolved = JsonNode.Parse(settings.ResolvedJson);
        return new RoundSettingsResponse(
            resolved?[SchemaVersionKey]?.GetValue<int>() ?? 0,
            settings.LayerJson is null ? null : JsonNode.Parse(settings.LayerJson),
            resolved,
            settings.Sources);
    }
}

internal sealed record GoingEntry(Guid MemberId, MemberType MemberType, AttendanceSource Source, int Position, bool Promoted);

internal sealed record WaitlistEntry(Guid MemberId, MemberType MemberType, int Position);

/// <summary>The caller's own line: no <c>status</c> and no <c>position</c> until they answer.</summary>
internal sealed record MeResponse(Guid MemberId, AttendanceStatus? Status, int? Position, int? RegularPosition)
{
    public static MeResponse From(Round round, MemberId me)
    {
        ArgumentNullException.ThrowIfNull(round);
        return new MeResponse(me.Value, round.AttendanceOf(me)?.Status, round.PositionOf(me), round.RegularPositionOf(me));
    }
}

/// <summary>One line of the list of rounds (tela 06): counts and the caller's own place, not the lists.</summary>
internal sealed record RoundSummaryResponse(
    Guid RoundId,
    string LocalDate,
    string LocalTime,
    DateTimeOffset StartsAt,
    string Venue,
    RoundStatus Status,
    int? Capacity,
    int GoingCount,
    int WaitlistCount,
    SummaryMe Me)
{
    public static RoundSummaryResponse From(Round round, ResolvedRound resolved, MemberId me)
    {
        ArgumentNullException.ThrowIfNull(round);
        ArgumentNullException.ThrowIfNull(resolved);
        return new RoundSummaryResponse(
            round.Id.Value,
            RoundFormat.Date(round.Slot.Date),
            RoundFormat.Time(round.Slot.Time),
            round.Slot.StartsAt,
            round.Venue.Value,
            round.Status,
            resolved.Rules.CapacityLimited ? resolved.Rules.Capacity : null,
            round.SpotsHeld,
            round.Waitlist.Length,
            new SummaryMe(round.AttendanceOf(me)?.Status, round.PositionOf(me)));
    }
}

internal sealed record SummaryMe(AttendanceStatus? Status, int? Position);

/// <summary>What routes 6 and 7 answer: the member's state and place after the change.</summary>
internal sealed record AttendanceAnswerResponse(AttendanceStatus Status, int? Position)
{
    public static AttendanceAnswerResponse From(Round round, MemberId member)
    {
        ArgumentNullException.ThrowIfNull(round);
        return new AttendanceAnswerResponse(round.AttendanceOf(member)?.Status ?? AttendanceStatus.NotGoing, round.PositionOf(member));
    }
}

/// <summary>Dates as "YYYY-MM-DD" and times as "HH:mm", the way the screens and the requests write them.</summary>
internal static class RoundFormat
{
    public const string DateFormat = "yyyy-MM-dd";
    public const string TimeFormat = "HH:mm";

    public static string Date(DateOnly date) => date.ToString(DateFormat, CultureInfo.InvariantCulture);

    public static string Time(TimeOnly time) => time.ToString(TimeFormat, CultureInfo.InvariantCulture);
}
