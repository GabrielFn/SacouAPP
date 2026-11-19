using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;
using Sacou.Shared.Results;
using SessionRules = Sacou.Modules.Sessions.Domain.Attendances.AttendanceRules;

namespace Sacou.Modules.Sessions.Application;

/// <summary>"Vou" or "não vou" under the round's lock, for the player (route 6, or the round link), or for the admin (route 7).</summary>
internal static class AttendanceAnswering
{
    /// <summary>
    /// First the round is brought in line with the group (whoever left goes out, the waitlist fills the free spots),
    /// then the answer is decided on that, so a departed member never holds the last spot against the one who asks.
    /// Nothing is written when the answer is refused.
    /// </summary>
    public static Result<RoundChange> Answer(
        RoundWriteContext context, Respondent respondent, AttendanceResponse response, ResponseActor actor, AttendanceChannel channel)
    {
        ArgumentNullException.ThrowIfNull(context);
        var rules = context.Group.ResolveStored(context.Round).Rules;
        var cleaned = RoundReconciliation.Reconcile(context.Round, rules, context.Group.ActiveIds, context.Now);
        var answered = SessionRules.Respond(cleaned.Round, rules, respondent, response, actor, context.Now, channel);
        return answered.IsSuccess ? Result.Success(cleaned.Then(_ => answered.Value)) : answered;
    }

    public static Respondent Respondent(GroupMembership member) =>
        new(new MemberId(member.MemberId), member.Type == MemberType.Regular ? MemberKind.Regular : MemberKind.DropIn);
}
