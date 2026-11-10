using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>Builders for the domain tests. "Now" is a Tuesday morning; the round is the next Tuesday at 20:30 local.</summary>
internal static class RoundFixture
{
    public static readonly DateTimeOffset Now = new(2026, 11, 10, 12, 0, 0, TimeSpan.Zero);
    public static readonly DateOnly RoundDate = new(2026, 11, 17);
    public static readonly TimeOnly RoundTime = new(20, 30);
    public static readonly GroupId Group = new(Guid.Parse("00000000-0000-0000-0000-0000000000a1"));

    public static MemberId Member(int number) => new(new Guid(number, 0, 0, [0, 0, 0, 0, 0, 0, 0, 1]));

    public static AttendanceSettings Rules(
        bool enabled = true,
        bool limited = true,
        int capacity = 12,
        bool waitlist = true,
        bool regulars = true,
        bool window = false,
        int hours = 24) => new(enabled, limited, capacity, waitlist, regulars, window, hours);

    public static Round NewRound() => Round.Create(
        RoundId.New(Now), Group, series: null, RoundSlot.At(RoundDate, RoundTime), Venue.Empty, settingsLayerJson: null).Round;

    public static Round Answer(
        Round round,
        AttendanceSettings rules,
        int member,
        AttendanceResponse response,
        ResponseActor actor = ResponseActor.Self,
        MemberKind kind = MemberKind.DropIn,
        DateTimeOffset? now = null) =>
        Respond(round, rules, member, response, actor, kind, now).Value.Round;

    public static Sacou.Shared.Results.Result<RoundChange> Respond(
        Round round,
        AttendanceSettings rules,
        int member,
        AttendanceResponse response,
        ResponseActor actor = ResponseActor.Self,
        MemberKind kind = MemberKind.DropIn,
        DateTimeOffset? now = null) =>
        AttendanceRules.Respond(round, rules, new Respondent(Member(member), kind), response, actor, now ?? Now);

    /// <summary>Members 1..count say "vou", in order.</summary>
    public static Round Going(Round round, AttendanceSettings rules, int count)
    {
        for (var member = 1; member <= count; member++)
        {
            round = Answer(round, rules, member, AttendanceResponse.Going);
        }

        return round;
    }

    public static AttendanceStatus? StatusOf(Round round, int member) => round.AttendanceOf(Member(member))?.Status;
}
