using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.GetGroupSettings;

namespace Sacou.Modules.Groups.UpdateGroupSettings;

/// <summary>
/// <c>PATCH /v1/groups/{groupId}/settings</c> <c>{ settings }</c>: a partial layer of the group, merged leaf
/// by leaf under the settings lock. Any leaf the layer leaves out stays as it is.
/// </summary>
internal static class UpdateGroupSettingsEndpoint
{
    public const string Name = "UpdateGroupSettings";

    public static RouteGroupBuilder MapUpdateGroupSettings(this RouteGroupBuilder group)
    {
        group.MapPatch(GetGroupSettingsEndpoint.Route, HandleAsync).WithName(Name)
            .RequireGroupPermission(GroupPermission.ManageSettings)
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return group;
    }

    private static async Task<Results<Ok<GroupSettingsResponse>, ProblemHttpResult>> HandleAsync(
        UpdateGroupSettingsRequest request, HttpContext context, UpdateGroupSettingsHandler handler, CancellationToken cancellationToken)
    {
        var updated = await handler.HandleAsync(context.GroupAccess(), request.Settings, cancellationToken).ConfigureAwait(false);
        return updated.ToHttpResult(body => TypedResults.Ok(body));
    }
}

/// <summary>Only <c>settings</c>: a field the record does not declare is a 400 (ADR 0039), so no member or group id can be sent.</summary>
internal sealed record UpdateGroupSettingsRequest(JsonElement? Settings);
