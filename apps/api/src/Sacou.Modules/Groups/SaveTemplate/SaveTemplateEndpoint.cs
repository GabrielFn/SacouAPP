using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.ListSavedTemplates;

namespace Sacou.Modules.Groups.SaveTemplate;

/// <summary>
/// <c>POST /v1/groups/{groupId}/templates</c> <c>{ name }</c>: saves a snapshot of the settings of the group
/// that are not facts. 201 with the template as listed; 409 past the ceiling of 20 per group.
/// </summary>
internal static class SaveTemplateEndpoint
{
    public const string Name = "SaveGroupTemplate";

    public static RouteGroupBuilder MapSaveTemplate(this RouteGroupBuilder group)
    {
        group.MapPost(ListSavedTemplatesEndpoint.Route, HandleAsync).WithName(Name)
            .RequireGroupPermission(GroupPermission.ManageSettings)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict);
        return group;
    }

    private static async Task<Results<Created<SavedTemplateResponse>, ProblemHttpResult>> HandleAsync(
        SaveTemplateRequest request, HttpContext context, SaveTemplateHandler handler, CancellationToken cancellationToken)
    {
        var saved = await handler.HandleAsync(context.GroupAccess(), request.Name, cancellationToken).ConfigureAwait(false);
        return saved.ToHttpResult(body => TypedResults.Created((string?)null, body));
    }
}

/// <summary>Only the name: a field the record does not declare is a 400 (ADR 0039).</summary>
internal sealed record SaveTemplateRequest(string? Name);
