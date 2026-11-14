using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Net.Http.Headers;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.SetMemberLevels;

/// <summary>
/// <c>PUT /v1/groups/{groupId}/member-levels</c> <c>{ levels: [{ memberId, level }] }</c>: from 1 to
/// <see cref="MemberLevelLimits.MaxBatch"/> members, none twice, all of them or none (screen 19, "Confirmar todas").
/// A member of another group, one who left and one never seen all answer <c>groups.member-not-found</c>.
/// </summary>
internal static class SetMemberLevelsEndpoint
{
    private const string NoStore = "no-store";

    public const string Name = "SetMemberLevels";
    public const string Route = "/member-levels";

    public static RouteGroupBuilder MapSetMemberLevels(this RouteGroupBuilder group)
    {
        group.MapPut(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageMemberLevels)
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return group;
    }

    private static async Task<Results<Ok<IReadOnlyList<MemberLevelSetResponse>>, ProblemHttpResult>> HandleAsync(
        SetMemberLevelsRequest request, HttpContext context, SetMemberLevelsHandler handler, CancellationToken cancellationToken)
    {
        if (request.Levels is not { } items || items.Any(item => item is null))
        {
            return Result.Failure<MemberLevelChange>(GroupErrors.LevelInvalid).ToHttpResult(MemberLevelSetResponse.ListOf);
        }

        context.Response.Headers[HeaderNames.CacheControl] = NoStore;
        var access = context.GroupAccess();
        RequestedLevel[] requested = [.. items.Select(item => new RequestedLevel(item!.MemberId, item.Level))];
        var changed = await handler.HandleAsync(access.GroupId, access.Member.Id, requested, cancellationToken).ConfigureAwait(false);
        return changed.ToHttpResult(MemberLevelSetResponse.ListOf);
    }
}

/// <summary>The list must be there; an empty one is a 400 of the rule, not of the body. A field not declared is a 400 (ADR 0039).</summary>
internal sealed record SetMemberLevelsRequest([property: JsonRequired] IReadOnlyList<SetMemberLevelItem?>? Levels);

/// <summary>Both keys must be there; <c>level</c> is a JSON number or null ("Não sei"), never text.</summary>
internal sealed record SetMemberLevelItem(
    [property: JsonRequired] Guid MemberId,
    [property: JsonRequired, JsonNumberHandling(JsonNumberHandling.Strict)] decimal? Level);

/// <summary>A level as written: always reviewed. Never the author nor the time (minimization).</summary>
internal sealed record MemberLevelSetResponse(Guid MemberId, decimal? AdminLevel, bool Reviewed)
{
    public static MemberLevelSetResponse From(MemberLevel level) => new(level.MemberId.Value, level.Level?.ToDecimal(), Reviewed: true);

    public static Ok<IReadOnlyList<MemberLevelSetResponse>> ListOf(MemberLevelChange change)
    {
        IReadOnlyList<MemberLevelSetResponse> body = [.. change.Levels.Select(From)];
        return TypedResults.Ok(body);
    }
}
