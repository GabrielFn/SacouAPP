using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Attendances;

/// <summary>The two rows of the transition table of ADR 0043, D1.</summary>
internal static partial class AttendanceRules
{
    /// <summary>"Vou": already going or waiting changes nothing; otherwise a spot, the line or <c>round-full</c>, with a new sequence.</summary>
    private static Result<RoundChange> Join(Round round, AttendanceSettings rules, MemberId member, AttendanceSource source, DateTimeOffset now)
    {
        if (round.AttendanceOf(member) is { HoldsSpot: true } or { IsWaiting: true })
        {
            return Result.Success(RoundChange.Unchanged(round));
        }

        var status = StatusForNewcomer(round, rules);
        if (status is null)
        {
            return Result.Failure<RoundChange>(RoundErrors.RoundFull);
        }

        return Result.Success(Place(round, member, status.Value, source, now));
    }

    /// <summary>"Não vou": whoever held a spot frees it, and the first in line is promoted by the caller's step.</summary>
    private static Result<RoundChange> Leave(Round round, AttendanceSettings rules, MemberId member, AttendanceSource source, DateTimeOffset now)
    {
        var existing = round.AttendanceOf(member);
        if (existing is { Status: AttendanceStatus.NotGoing })
        {
            return Result.Success(RoundChange.Unchanged(round));
        }

        var declined = existing is null
            ? Place(round, member, AttendanceStatus.NotGoing, source, now)
            : Decline(round, existing, source, now);
        return Result.Success(declined.Then(next => RoundReconciliation.PromoteFromWaitlist(next, rules, now)));
    }

    private static RoundChange Decline(Round round, Attendance existing, AttendanceSource source, DateTimeOffset now)
    {
        var declined = existing.Decline(now);
        return new RoundChange(round.With(declined), [declined], [new AttendanceChanged(round.Id, existing.Member, AttendanceStatus.NotGoing)]);
    }

    /// <summary>Room: a spot. No room: the line, if there is one; otherwise nothing.</summary>
    internal static AttendanceStatus? StatusForNewcomer(Round round, AttendanceSettings rules)
    {
        if (rules.HasRoom(round.SpotsHeld))
        {
            return AttendanceStatus.Going;
        }

        return rules.WaitlistEnabled ? AttendanceStatus.Waitlisted : null;
    }

    /// <summary>A new row, or a returning one, with the next order number of the round.</summary>
    internal static RoundChange Place(Round round, MemberId member, AttendanceStatus status, AttendanceSource source, DateTimeOffset now)
    {
        var change = NewAttendance(round, member, status, source, now);
        return change with { Events = [new AttendanceChanged(round.Id, member, status)] };
    }

    private static RoundChange NewAttendance(Round round, MemberId member, AttendanceStatus status, AttendanceSource source, DateTimeOffset now)
    {
        var attendance = new Attendance(member, status, round.NextSequence, source, now, PromotedAt: null);
        var placed = round.With(attendance);
        // Only a row that enters the order spends a number; a first "não vou" holds the counter's value without taking it.
        return new RoundChange(status == AttendanceStatus.NotGoing ? placed : placed.WithNextSequenceTaken(), [attendance], []);
    }
}
