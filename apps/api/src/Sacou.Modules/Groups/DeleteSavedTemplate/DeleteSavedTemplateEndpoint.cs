using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Permissions;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Domain.Templates;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.ListSavedTemplates;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.DeleteSavedTemplate;

/// <summary>
/// <c>DELETE /v1/groups/{groupId}/templates/{templateId}</c>: 204; the second time, and a template of another
/// group, are the same 404 (the template is found by <c>(group_id, id)</c>). If the label "Modelo usado" of
/// the group points at it, the label is cleared in the same transaction.
/// </summary>
internal static class DeleteSavedTemplateEndpoint
{
    public const string Name = "DeleteGroupTemplate";

    public static RouteGroupBuilder MapDeleteSavedTemplate(this RouteGroupBuilder group)
    {
        group.MapDelete(ListSavedTemplatesEndpoint.Route + "/{templateId:guid}", HandleAsync).WithName(Name)
            .RequireGroupPermission(GroupPermission.ManageSettings);
        return group;
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid templateId, HttpContext context, IGroupSettingsStore store, TimeProvider time, CancellationToken cancellationToken)
    {
        var access = context.GroupAccess();
        var id = new TemplateId(templateId);
        var removed = await store.ExecuteInSettingsLockAsync(
            access.GroupId,
            access.Member.Id,
            state => state.Templates.Any(known => known.Id == id)
                ? Result.Success(new SettingsChange(Unlabelled(state, id, time)) { Removed = id })
                : Result.Failure<SettingsChange>(GroupErrors.TemplateNotFound),
            cancellationToken).ConfigureAwait(false);
        return removed.ToHttpResult(_ => TypedResults.NoContent());
    }

    private static StoredSettings Unlabelled(SettingsState state, TemplateId removed, TimeProvider time) =>
        state.Current.SavedTemplateId == removed ? state.Current with { SavedTemplateId = null, UpdatedAt = time.GetUtcNow() } : state.Current;
}
