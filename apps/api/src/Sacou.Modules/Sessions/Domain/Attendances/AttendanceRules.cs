using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Attendances;

/// <summary>
/// The reducer of attendance: a pure function from the round, the rules, who answers and what they answer to
/// the change to write, or a refusal (ADR 0043, D1 and D2). The clock comes in as <c>now</c>. The answers to
/// questions 24 to 27 live here and nowhere else: mensalistas who do not fit wait ahead of the avulsos
/// (<see cref="RoundReconciliation.SeedRegulars"/>), a mensalista who comes back goes to the end of the line,
/// lowering the capacity takes nobody out, and the player answers until the round starts.
/// </summary>
internal static partial class AttendanceRules
{
    public static Result<RoundChange> Respond(
        Round round,
        AttendanceSettings rules,
        Respondent respondent,
        AttendanceResponse response,
        ResponseActor actor,
        DateTimeOffset now,
        AttendanceChannel channel)
    {
        if (Refusal(round, rules, respondent, response, actor, now) is { } refusal)
        {
            return Result.Failure<RoundChange>(refusal);
        }

        var repaired = RoundReconciliation.PromoteFromWaitlist(round, rules, now);
        var origin = new AnswerOrigin(SourceOf(actor), channel);
        var answered = response == AttendanceResponse.Going
            ? Join(repaired.Round, rules, respondent.Id, origin, now)
            : Leave(repaired.Round, rules, respondent.Id, origin, now);
        return answered.IsSuccess ? Result.Success(repaired.Then(_ => answered.Value)) : answered;
    }

    private static Error? Refusal(
        Round round, AttendanceSettings rules, Respondent respondent, AttendanceResponse response, ResponseActor actor, DateTimeOffset now)
    {
        if (round.IsCanceled || (actor == ResponseActor.Self && round.ClosedAt is not null))
        {
            return RoundErrors.RoundClosed;
        }

        if (!rules.Enabled)
        {
            return RoundErrors.AttendanceDisabled;
        }

        if (actor == ResponseActor.Self && now > round.Slot.StartsAt)
        {
            return RoundErrors.RoundClosed;
        }

        return actor == ResponseActor.Self && response == AttendanceResponse.Going && IsBeforeDropInWindow(round, rules, respondent, now)
            ? RoundErrors.DropInWindowClosed
            : null;
    }

    /// <summary>Only an avulso answering for themselves; mensalistas have no window and the admin ignores it.</summary>
    private static bool IsBeforeDropInWindow(Round round, AttendanceSettings rules, Respondent respondent, DateTimeOffset now) =>
        rules.DropInWindowEnabled
        && respondent.Kind == MemberKind.DropIn
        && now < round.Slot.DropInOpensAt(rules.DropInOpensHoursBefore);

    private static AttendanceSource SourceOf(ResponseActor actor) =>
        actor == ResponseActor.Admin ? AttendanceSource.Admin : AttendanceSource.Self;
}
