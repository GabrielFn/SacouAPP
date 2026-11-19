using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.RoundLinks;

/// <summary>
/// The answer and, before it, whether the caller came into the group: null when the refusal came before the group step.
/// </summary>
internal sealed record RoundLinkAttempt(bool? Joined, Result<RoundLinkAnswerResponse> Answer)
{
    public static RoundLinkAttempt Refused(Error error) => new(null, Result.Failure<RoundLinkAnswerResponse>(error));
}

/// <summary>
/// The order of ADR 0070, D2, never holding two locks at once: (1) the code, and the round still open (not cancelled,
/// not started), without a lock; (2) the group, in the Groups' own committed transaction, when the caller is not an
/// active member; (3) the answer under the round's lock, by the same <see cref="RoundWriter"/> as the app's "vou", which
/// asks the Groups again and checks the round is still open. The log keeps the outcome and the round id only: never the
/// code, the person or the group's name.
/// </summary>
internal sealed partial class AnswerByRoundLinkHandler(
    ICurrentUser currentUser,
    RoundLinkReader reader,
    IGroupMembership membership,
    IGroupJoining joining,
    RoundWriter writer,
    TimeProvider time,
    ILogger<AnswerByRoundLinkHandler> logger)
{
    private const string Answered = "answered";

    public async Task<RoundLinkAttempt> HandleAsync(string? code, AttendanceResponse response, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return RoundLinkAttempt.Refused(user.Error);
        }

        var round = await reader.FindAsync(code, cancellationToken).ConfigureAwait(false);
        if (round.IsFailure)
        {
            return RoundLinkAttempt.Refused(round.Error);
        }

        var attempt = await AnswerOpenRoundAsync(round.Value, user.Value.UserId, response, cancellationToken).ConfigureAwait(false);
        var outcome = attempt.Answer.Match(_ => Answered, error => error.Code);
        LogAnswer(logger, outcome, round.Value.Id.Value);
        return attempt;
    }

    private async Task<RoundLinkAttempt> AnswerOpenRoundAsync(Round round, Guid userId, AttendanceResponse response, CancellationToken cancellationToken)
    {
        if (!round.IsOpenForLinkAt(time.GetUtcNow()))
        {
            return RoundLinkAttempt.Refused(RoundErrors.RoundClosed);
        }

        var (member, joined) = await MemberOfAsync(round.GroupId, userId, cancellationToken).ConfigureAwait(false);
        if (member.IsFailure)
        {
            return new RoundLinkAttempt(joined, Result.Failure<RoundLinkAnswerResponse>(member.Error));
        }

        var caller = member.Value;
        var access = new RoundAccess(round.GroupId, userId, new MemberId(caller.MemberId), caller.Role, caller.Type);
        var written = await writer.ExecuteAsync(access, round.Id, GroupCapability.RespondAttendance, Decide(response), cancellationToken)
            .ConfigureAwait(false);
        var answer = written.Match(
            outcome => Result.Success(ToResponse(outcome.Change.Round, access.MemberId, joined ?? false)),
            Result.Failure<RoundLinkAnswerResponse>);
        return new RoundLinkAttempt(joined, answer);
    }

    /// <summary>
    /// The caller's active membership, coming in as an avulso first when there is none. <c>Joined</c> is null only when
    /// the group step itself refused; it stays known when the person came in and is gone before the second read.
    /// </summary>
    private async Task<(Result<GroupMembership> Member, bool? Joined)> MemberOfAsync(GroupId group, Guid userId, CancellationToken cancellationToken)
    {
        var existing = await membership.FindActiveAsync(group.Value, userId, cancellationToken).ConfigureAwait(false);
        if (existing is not null)
        {
            return (Result.Success(existing), false);
        }

        var joined = await joining.JoinAsDropInAsync(group.Value, userId, cancellationToken).ConfigureAwait(false);
        if (joined.IsFailure)
        {
            return (Result.Failure<GroupMembership>(joined.Error), null);
        }

        // Removed or gone between the commit of the group step and this read: the non-member answer of every group route.
        var member = await membership.FindActiveAsync(group.Value, userId, cancellationToken).ConfigureAwait(false);
        return member is null
            ? (Result.Failure<GroupMembership>(GroupAccessErrors.GroupNotFound), joined.Value.Joined)
            : (Result.Success(member), joined.Value.Joined);
    }

    /// <summary>Under the lock: the caller as the Groups says now, the round still open at the lock's clock, then the app's own rules.</summary>
    private static Func<RoundWriteContext, Result<RoundChange>> Decide(AttendanceResponse response) => context =>
    {
        if (context.Caller is not { } caller)
        {
            return Result.Failure<RoundChange>(GroupAccessErrors.GroupNotFound);
        }

        return context.Round.IsOpenForLinkAt(context.Now)
            ? AttendanceAnswering.Answer(context, AttendanceAnswering.Respondent(caller), response, ResponseActor.Self, AttendanceChannel.Web)
            : Result.Failure<RoundChange>(RoundErrors.RoundClosed);
    };

    private static RoundLinkAnswerResponse ToResponse(Round round, MemberId member, bool joined)
    {
        var answer = AttendanceAnswerResponse.From(round, member);
        return new RoundLinkAnswerResponse(round.GroupId.Value, round.Id.Value, member.Value, joined, answer.Status, answer.Position);
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Round link answer: {Outcome}, round {RoundId}.")]
    private static partial void LogAnswer(ILogger logger, string outcome, Guid roundId);
}
