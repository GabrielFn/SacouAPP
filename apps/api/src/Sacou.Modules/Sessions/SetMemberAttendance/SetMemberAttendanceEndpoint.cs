using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RespondAttendance;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.SetMemberAttendance;

/// <summary>
/// <c>PUT /v1/groups/{groupId}/rounds/{roundId}/attendance/{memberId}</c> <c>{ response }</c> (<c>ManageRounds</c>):
/// the admin adds or removes someone (tela 21, "chegou alguém na quadra"). Ignores the avulso window and the
/// start time, never the spots. The target must be an active member of the route's group: one who is missing, left,
/// was removed or belongs to another group all answer <c>sessions.member-not-found</c> (IDOR, ADR 0043, D9).
/// </summary>
internal static class SetMemberAttendanceEndpoint
{
    public const string Name = "SetMemberAttendance";
    public const string Route = "/rounds/{roundId:guid}/attendance/{memberId:guid}";

    public static RouteGroupBuilder MapSetMemberAttendance(this RouteGroupBuilder group)
    {
        group.MapPut(Route, HandleAsync).WithName(Name)
            .RequireCapability(GroupCapability.ManageRounds)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return group;
    }

    private static async Task<Results<Ok<AttendanceAnswerResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, Guid memberId, AttendanceRequest request, HttpContext context, SetMemberAttendanceHandler handler, CancellationToken cancellationToken)
    {
        var answered = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), new MemberId(memberId), request.Response, cancellationToken)
            .ConfigureAwait(false);
        return answered.ToHttpResult(answer => TypedResults.Ok(answer));
    }
}

internal sealed class SetMemberAttendanceHandler(RoundWriter writer)
{
    public async Task<Result<AttendanceAnswerResponse>> HandleAsync(
        RoundAccess access, RoundId id, MemberId target, AttendanceResponse response, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var written = await writer.ExecuteAsync(access, id, GroupCapability.ManageRounds, context => Set(context, target, response), cancellationToken)
            .ConfigureAwait(false);
        return written.IsFailure
            ? Result.Failure<AttendanceAnswerResponse>(written.Error)
            : Result.Success(AttendanceAnswerResponse.From(written.Value.Change.Round, target));
    }

    private static Result<RoundChange> Set(RoundWriteContext context, MemberId target, AttendanceResponse response)
    {
        var member = context.Group.Members.FirstOrDefault(candidate => candidate.MemberId == target.Value);
        return member is null
            ? Result.Failure<RoundChange>(RoundErrors.MemberNotFound)
            : AttendanceAnswering.Answer(context, AttendanceAnswering.Respondent(member), response, ResponseActor.Admin);
    }
}
