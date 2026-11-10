using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.GetGroupSettings;

namespace Sacou.Modules.Groups.ApplyTemplate;

/// <summary>
/// <c>POST /v1/groups/{groupId}/settings/apply-template</c> <c>{ templateKey }</c> or <c>{ savedTemplateId }</c>
/// (exactly one): copies the template onto the group; the facts of the group stay.
/// </summary>
internal static class ApplyTemplateEndpoint
{
    public const string Name = "ApplyGroupSettingsTemplate";
    public const string Route = "/settings/apply-template";

    public static RouteGroupBuilder MapApplyTemplate(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name)
            .RequireGroupPermission(GroupPermission.ManageSettings)
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return group;
    }

    private static async Task<Results<Ok<GroupSettingsResponse>, ProblemHttpResult>> HandleAsync(
        ApplyTemplateRequest request, HttpContext context, ApplyTemplateHandler handler, CancellationToken cancellationToken)
    {
        var applied = await handler.HandleAsync(context.GroupAccess(), request, cancellationToken).ConfigureAwait(false);
        return applied.ToHttpResult(body => TypedResults.Ok(body));
    }
}

/// <summary>Exactly one of the two ids; a field the record does not declare is a 400 (ADR 0039).</summary>
internal sealed record ApplyTemplateRequest(string? TemplateKey, Guid? SavedTemplateId);
