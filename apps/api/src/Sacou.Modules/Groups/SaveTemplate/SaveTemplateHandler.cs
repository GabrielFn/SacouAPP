using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Domain.Templates;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Modules.Groups.ListSavedTemplates;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.SaveTemplate;

/// <summary>The name is checked first; the ceiling is counted under the settings lock, so a race cannot pass it.</summary>
internal sealed class SaveTemplateHandler(IGroupSettingsStore store, TimeProvider time)
{
    public async Task<Result<SavedTemplateResponse>> HandleAsync(GroupAccess access, string? name, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var templateName = TemplateName.Create(name);
        if (templateName.IsFailure)
        {
            return Result.Failure<SavedTemplateResponse>(templateName.Error);
        }

        var saved = await store.ExecuteInSettingsLockAsync(
            access.GroupId, access.Member.Id, state => Save(state, templateName.Value), cancellationToken).ConfigureAwait(false);
        return saved.IsSuccess
            ? Result.Success(Respond(saved.Value.Added!))
            : Result.Failure<SavedTemplateResponse>(saved.Error);
    }

    private Result<SettingsChange> Save(SettingsState state, TemplateName name)
    {
        var admitted = GroupLimits.CanSaveAnotherTemplate(state.Templates.Length);
        if (admitted.IsFailure)
        {
            return Result.Failure<SettingsChange>(admitted.Error);
        }

        var now = time.GetUtcNow();
        var snapshot = SettingsResolver.Snapshot(SettingsCatalogReader.Catalog, state.Current.Settings);
        return Result.Success(new SettingsChange(state.Current) { Added = new SavedTemplate(TemplateId.New(now), name, snapshot, now) });
    }

    private static SavedTemplateResponse Respond(SavedTemplate template) => new(template.Id.Value, template.Name.Value, template.CreatedAt);
}
