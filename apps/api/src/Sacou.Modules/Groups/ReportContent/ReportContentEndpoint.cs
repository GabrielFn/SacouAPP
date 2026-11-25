using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Domain.Reports;
using Sacou.Shared.Members;

namespace Sacou.Modules.Groups.ReportContent;

/// <summary>
/// <c>POST /v1/groups/{groupId}/reports</c> <c>{ reportedMemberId, reason }</c>: 204 (E6.6). Any active member reports
/// another member's name (sheet 19c) or, with a null member, the group's name and venue (screen 18). The same report again
/// is the same 204 and one row. The answer never says how many reports there are, nor who made them.
/// </summary>
internal static class ReportContentEndpoint
{
    public const string Name = "ReportContent";
    public const string Route = "/reports";

    public static RouteGroupBuilder MapReportContent(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ReportContent)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);
        return group;
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        ReportContentRequest request, HttpContext context, ReportContentHandler handler, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var reported = request.ReportedMemberId is { } member ? new MemberId(member) : (MemberId?)null;
        var report = await handler.HandleAsync(access.GroupId, access.Member.Id, reported, request.Reason, cancellationToken)
            .ConfigureAwait(false);
        return report.ToHttpResult(_ => TypedResults.NoContent());
    }
}

/// <summary>Both fields must be there: a member id, or null for the group, and one reason of the closed list. No free text.</summary>
internal sealed record ReportContentRequest(
    [property: JsonRequired] Guid? ReportedMemberId,
    [property: JsonRequired] ContentReportReason Reason);
