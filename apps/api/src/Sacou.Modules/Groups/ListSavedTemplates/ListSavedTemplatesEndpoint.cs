using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Infrastructure;

namespace Sacou.Modules.Groups.ListSavedTemplates;

/// <summary><c>GET /v1/groups/{groupId}/templates</c>: the saved templates of the group, oldest first. Only who manages settings may list them.</summary>
internal static class ListSavedTemplatesEndpoint
{
    public const string Name = "ListGroupTemplates";
    public const string Route = "/templates";

    public static RouteGroupBuilder MapListSavedTemplates(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireGroupPermission(GroupPermission.ManageSettings);
        return group;
    }

    private static async Task<Ok<IReadOnlyList<SavedTemplateResponse>>> HandleAsync(
        HttpContext context, IGroupSettingsStore store, CancellationToken cancellationToken)
    {
        var templates = await store.ListTemplatesAsync(context.GroupAccess().GroupId, cancellationToken).ConfigureAwait(false);
        return TypedResults.Ok<IReadOnlyList<SavedTemplateResponse>>([.. templates.Select(SavedTemplateResponse.From)]);
    }
}

/// <summary>A saved template as the app lists it: no snapshot and no member id.</summary>
internal sealed record SavedTemplateResponse(Guid TemplateId, string Name, DateTimeOffset CreatedAt)
{
    public static SavedTemplateResponse From(TemplateSummary template)
    {
        ArgumentNullException.ThrowIfNull(template);
        return new SavedTemplateResponse(template.Id.Value, template.Name.Value, template.CreatedAt);
    }
}
