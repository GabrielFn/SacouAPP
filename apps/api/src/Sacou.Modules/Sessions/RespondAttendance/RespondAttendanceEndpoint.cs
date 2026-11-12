using System.Text.Json.Serialization;
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
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.RespondAttendance;

/// <summary>
/// <c>PUT /v1/groups/{groupId}/rounds/{roundId}/attendance/me</c> <c>{ response }</c> (<c>RespondAttendance</c>):
/// the player's own "vou" or "não vou". Idempotent: the same answer twice is a 200 with no new place in line.
/// The member is the caller's, from the access filter: it is never in the body.
/// </summary>
internal static class RespondAttendanceEndpoint
{
    public const string Name = "RespondAttendance";
    public const string Route = "/rounds/{roundId:guid}/attendance/me";

    public static RouteGroupBuilder MapRespondAttendance(this RouteGroupBuilder group)
    {
        group.MapPut(Route, HandleAsync).WithName(Name)
            .RequireCapability(GroupCapability.RespondAttendance)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return group;
    }

    private static async Task<Results<Ok<AttendanceAnswerResponse>, ProblemHttpResult>> HandleAsync(
        Guid roundId, AttendanceRequest request, HttpContext context, RespondAttendanceHandler handler, CancellationToken cancellationToken)
    {
        var answered = await handler.HandleAsync(context.RoundAccess(), new RoundId(roundId), request.Response, cancellationToken).ConfigureAwait(false);
        return answered.ToHttpResult(answer => TypedResults.Ok(answer));
    }
}

/// <summary>Only <c>response</c>, and required: an absent, null or unknown value is a 400, never a default "vou".</summary>
internal sealed record AttendanceRequest([property: JsonRequired] AttendanceResponse Response);

internal sealed class RespondAttendanceHandler(RoundWriter writer)
{
    public async Task<Result<AttendanceAnswerResponse>> HandleAsync(
        RoundAccess access, RoundId id, AttendanceResponse response, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var written = await writer.ExecuteAsync(access, id, GroupCapability.RespondAttendance, context => context.Caller is { } caller
            ? AttendanceAnswering.Answer(context, AttendanceAnswering.Respondent(caller), response, ResponseActor.Self)
            : Result.Failure<RoundChange>(GroupAccessErrors.GroupNotFound), cancellationToken)
            .ConfigureAwait(false);
        return written.IsFailure
            ? Result.Failure<AttendanceAnswerResponse>(written.Error)
            : Result.Success(AttendanceAnswerResponse.From(written.Value.Change.Round, access.MemberId));
    }
}
