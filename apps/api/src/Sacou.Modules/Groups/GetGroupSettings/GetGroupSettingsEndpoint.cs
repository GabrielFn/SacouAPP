using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.GetGroupSettings;

/// <summary><c>GET /v1/groups/{groupId}/settings</c>: any active member may see how the group plays (<c>ViewGroup</c>).</summary>
internal static class GetGroupSettingsEndpoint
{
    public const string Name = "GetGroupSettings";
    public const string Route = "/settings";

    public static RouteGroupBuilder MapGetGroupSettings(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ViewGroup);
        return group;
    }

    private static async Task<Results<Ok<GroupSettingsResponse>, ProblemHttpResult>> HandleAsync(
        HttpContext context, IGroupSettingsStore store, CancellationToken cancellationToken)
    {
        var stored = await store.FindAsync(context.GroupAccess().GroupId, cancellationToken).ConfigureAwait(false);
        var found = stored is null
            ? Result.Failure<GroupSettingsResponse>(GroupErrors.GroupNotFound)
            : Result.Success(GroupSettingsResponse.From(stored));
        return found.ToHttpResult(body => TypedResults.Ok(body));
    }
}
