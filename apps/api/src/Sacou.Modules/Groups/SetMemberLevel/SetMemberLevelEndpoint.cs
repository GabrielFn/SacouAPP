using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.SetMemberLevels;

namespace Sacou.Modules.Groups.SetMemberLevel;

/// <summary>
/// <c>PUT /v1/groups/{groupId}/member-levels/{memberId}</c> <c>{ level }</c>: one member, as a batch of one (screen
/// 19b). Any active member of the group, admins and the caller included (ADR 0051, D8). The same level again is a
/// success that renews the time.
/// </summary>
internal static class SetMemberLevelEndpoint
{
    private const string NoStore = "no-store";

    public const string Name = "SetMemberLevel";
    public const string Route = "/member-levels/{memberId:guid}";

    public static RouteGroupBuilder MapSetMemberLevel(this RouteGroupBuilder group)
    {
        group.MapPut(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageMemberLevels)
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return group;
    }

    private static async Task<Results<Ok<MemberLevelSetResponse>, ProblemHttpResult>> HandleAsync(
        Guid memberId, SetMemberLevelRequest request, HttpContext context, SetMemberLevelsHandler handler, CancellationToken cancellationToken)
    {
        context.Response.Headers[HeaderNames.CacheControl] = NoStore;
        var access = context.GroupAccess();
        var changed = await handler.HandleAsync(access.GroupId, access.Member.Id, [new RequestedLevel(memberId, request.Level)], cancellationToken)
            .ConfigureAwait(false);
        return changed.ToHttpResult(change => TypedResults.Ok(MemberLevelSetResponse.From(change.Levels[0])));
    }
}

/// <summary>Only the level, and it must be there: a JSON number on the scale, or null for "Não sei". No member id: the route has it.</summary>
internal sealed record SetMemberLevelRequest([property: JsonRequired, JsonNumberHandling(JsonNumberHandling.Strict)] decimal? Level);
