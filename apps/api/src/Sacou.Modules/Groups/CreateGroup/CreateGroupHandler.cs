using System.Text.Json;
using Sacou.Modules.Groups.Domain;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Modules.Groups.UpdateGroupSettings;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.CreateGroup;

/// <summary>
/// Registered user first, then the name, then the template and the optional settings layer (a bad one creates nothing), then, atomically in the store under the person's lock,
/// that the account still exists (ADR 0056, D7) and the per-person ceiling.
/// </summary>
internal sealed class CreateGroupHandler(ICurrentUser currentUser, IRegisteredUsers registeredUsers, IGroupStore store, TimeProvider time)
{
    private const string DefaultTemplateKey = "do-zero";

    public Task<Result<CreateGroupResponse>> HandleAsync(CreateGroupRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        return HandleAsync(request.Name, request.TemplateKey, request.Settings, cancellationToken);
    }

    private async Task<Result<CreateGroupResponse>> HandleAsync(string? name, string? templateKey, JsonElement? layer, CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<CreateGroupResponse>(user.Error);
        }

        var groupName = GroupName.Create(name);
        if (groupName.IsFailure)
        {
            return Result.Failure<CreateGroupResponse>(groupName.Error);
        }

        var settings = InitialSettings(templateKey, layer);
        if (settings.IsFailure)
        {
            return Result.Failure<CreateGroupResponse>(settings.Error);
        }

        var creator = new UserId(user.Value.UserId);
        var group = Group.Create(groupName.Value, creator, time.GetUtcNow());
        var stored = await store.CreateAsync(
            group,
            creator,
            cancellation => registeredUsers.ConfirmAsync(creator.Value, cancellation),
            GroupLimits.CanJoinAnotherGroup,
            settings.Value,
            cancellationToken).ConfigureAwait(false);
        return stored.Match(
            () => Result.Success(new CreateGroupResponse(group.Id.Value, group.Members[0].Id.Value)),
            Result.Failure<CreateGroupResponse>);
    }

    /// <summary>The group starts as "Do zero" with the template on top; a key the catalog does not know creates nothing.</summary>
    private Result<StoredSettings> InitialSettings(string? templateKey, JsonElement? layer)
    {
        var catalog = SettingsCatalogReader.Catalog;
        var key = templateKey ?? DefaultTemplateKey;
        var template = catalog.TemplateOf(key);
        if (template is null)
        {
            return Result.Failure<StoredSettings>(GroupErrors.UnknownTemplateKey);
        }

        var resolved = SettingsResolver.ApplyTemplate(catalog, SettingsResolver.Defaults(catalog), template);
        if (layer is null)
        {
            return Result.Success(new StoredSettings(resolved, key, SavedTemplateId: null, time.GetUtcNow()));
        }

        var patch = UpdateGroupSettingsHandler.ParsePatch(layer);
        return patch.IsFailure
            ? Result.Failure<StoredSettings>(patch.Error)
            : Result.Success(new StoredSettings(SettingsResolver.ApplyPatch(resolved, patch.Value), key, SavedTemplateId: null, time.GetUtcNow()));
    }
}
