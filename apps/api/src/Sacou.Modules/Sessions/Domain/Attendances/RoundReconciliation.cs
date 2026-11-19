using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Domain.Attendances;

/// <summary>
/// Brings a round back in line with its rules: whoever left the group goes out, and the waitlist fills the
/// free spots, first in line first (ADR 0043, D1 and D7). Runs at the end of every write under the lock and on
/// the read that repairs. It never takes anyone out of a spot for lack of room (question 26).
/// </summary>
internal static class RoundReconciliation
{
    /// <summary>Drops the departed, then promotes. A cancelled round or one with attendance off stays as it is.</summary>
    public static RoundChange Reconcile(
        Round round, AttendanceSettings rules, IReadOnlySet<MemberId> activeMembers, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(activeMembers);
        if (round.IsCanceled || !rules.Enabled)
        {
            return RoundChange.Unchanged(round);
        }

        return DropDeparted(round, activeMembers, now).Then(next => PromoteFromWaitlist(next, rules, now));
    }

    /// <summary>The first in line takes each free spot, automatically: nobody has to accept (<c>produto.md:64</c>).</summary>
    public static RoundChange PromoteFromWaitlist(Round round, AttendanceSettings rules, DateTimeOffset now)
    {
        if (round.IsCanceled || !rules.Enabled)
        {
            return RoundChange.Unchanged(round);
        }

        var promoted = round.Waitlist.Take(rules.FreeSpots(round.SpotsHeld)).Select(waiting => waiting.Promote(now)).ToImmutableArray();
        return new RoundChange(
            promoted.Aggregate(round, (current, attendance) => current.With(attendance)),
            promoted,
            [.. promoted.Select(attendance => (RoundEvent)new WaitlistPromoted(round.Id, attendance.Member, now))]);
    }

    /// <summary>
    /// The mensalistas of a new round, in the order they joined the group, are confirmed while there is room
    /// and wait in line after that, ahead of any avulso who asks later (question 24). Nothing without the
    /// attendance or the mensalista rule on.
    /// </summary>
    public static RoundChange SeedRegulars(
        Round round, AttendanceSettings rules, IReadOnlyList<MemberId> regularsInJoinOrder, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(regularsInJoinOrder);
        var change = RoundChange.Unchanged(round);
        if (!rules.Enabled || !rules.RegularsEnabled)
        {
            return change;
        }

        foreach (var regular in regularsInJoinOrder)
        {
            change = change.Then(current => SeedOne(current, rules, regular, now));
        }

        return change;
    }

    private static RoundChange SeedOne(Round round, AttendanceSettings rules, MemberId regular, DateTimeOffset now) =>
        AttendanceRules.StatusForNewcomer(round, rules) is { } status
            ? AttendanceRules.Place(round, regular, status, AnswerOrigin.Regular, now)
            : RoundChange.Unchanged(round);

    private static RoundChange DropDeparted(Round round, IReadOnlySet<MemberId> activeMembers, DateTimeOffset now)
    {
        var departed = round.Attendances
            .Where(attendance => attendance.Status != AttendanceStatus.NotGoing && !activeMembers.Contains(attendance.Member))
            .Select(attendance => attendance.Decline(now))
            .ToImmutableArray();
        return new RoundChange(
            departed.Aggregate(round, (current, attendance) => current.With(attendance)),
            departed,
            [.. departed.Select(attendance => (RoundEvent)new AttendanceChanged(round.Id, attendance.Member, AttendanceStatus.NotGoing))]);
    }
}
