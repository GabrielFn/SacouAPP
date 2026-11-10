using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.GetGroupSettings;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.ApplyTemplate;

/// <summary>
/// A ready-made template comes from the catalog; a saved one from the templates read under the lock,
/// which belong to this group alone: the id of another group's template is a plain "not found" (ADR 0041).
/// </summary>
internal sealed class ApplyTemplateHandler(IGroupSettingsStore store, TimeProvider time)
{
    public async Task<Result<GroupSettingsResponse>> HandleAsync(GroupAccess access, ApplyTemplateRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        ArgumentNullException.ThrowIfNull(request);
        if (request.TemplateKey is null == request.SavedTemplateId is null)
        {
            return Result.Failure<GroupSettingsResponse>(GroupErrors.SettingsInvalid);
        }

        var applied = await store.ExecuteInSettingsLockAsync(
            access.GroupId, access.Member.Id, state => Apply(state, request), cancellationToken).ConfigureAwait(false);
        return applied.IsSuccess
            ? Result.Success(GroupSettingsResponse.From(applied.Value.Settings))
            : Result.Failure<GroupSettingsResponse>(applied.Error);
    }

    private Result<SettingsChange> Apply(SettingsState state, ApplyTemplateRequest request)
    {
        var catalog = SettingsCatalogReader.Catalog;
        var now = time.GetUtcNow();
        if (request.TemplateKey is { } key)
        {
            return catalog.TemplateOf(key) is { } template
                ? Result.Success(new SettingsChange(new StoredSettings(
                    SettingsResolver.ApplyTemplate(catalog, state.Current.Settings, template), key, SavedTemplateId: null, now)))
                : Result.Failure<SettingsChange>(GroupErrors.TemplateNotFound);
        }

        var saved = state.Templates.FirstOrDefault(known => known.Id.Value == request.SavedTemplateId);
        return saved is null
            ? Result.Failure<SettingsChange>(GroupErrors.TemplateNotFound)
            : Result.Success(new SettingsChange(new StoredSettings(
                SettingsResolver.ApplySnapshot(catalog, state.Current.Settings, saved.Snapshot), TemplateKey: null, saved.Id, now)));
    }
}
