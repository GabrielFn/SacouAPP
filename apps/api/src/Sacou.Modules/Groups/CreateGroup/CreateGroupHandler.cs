using Sacou.Modules.Groups.Domain;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.CreateGroup;

/// <summary>Registered user first, then the name, then the template, then the per-person ceiling, checked atomically by the store.</summary>
internal sealed class CreateGroupHandler(ICurrentUser currentUser, IGroupStore store, TimeProvider time)
{
    private const string DefaultTemplateKey = "do-zero";

    public Task<Result<CreateGroupResponse>> HandleAsync(CreateGroupRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        return HandleAsync(request.Name, request.TemplateKey, cancellationToken);
    }

    private async Task<Result<CreateGroupResponse>> HandleAsync(string? name, string? templateKey, CancellationToken cancellationToken)
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

        var settings = InitialSettings(templateKey);
        if (settings.IsFailure)
        {
            return Result.Failure<CreateGroupResponse>(settings.Error);
        }

        var creator = new UserId(user.Value.UserId);
        var group = Group.Create(groupName.Value, creator, time.GetUtcNow());
        var stored = await store.CreateAsync(group, creator, GroupLimits.CanJoinAnotherGroup, settings.Value, cancellationToken).ConfigureAwait(false);
        return stored.Match(
            () => Result.Success(new CreateGroupResponse(group.Id.Value, group.Members[0].Id.Value)),
            Result.Failure<CreateGroupResponse>);
    }

    /// <summary>The group starts as "Do zero" with the template on top; a key the catalog does not know creates nothing.</summary>
    private Result<StoredSettings> InitialSettings(string? templateKey)
    {
        var catalog = SettingsCatalogReader.Catalog;
        var key = templateKey ?? DefaultTemplateKey;
        var template = catalog.TemplateOf(key);
        return template is null
            ? Result.Failure<StoredSettings>(GroupErrors.UnknownTemplateKey)
            : Result.Success(new StoredSettings(
                SettingsResolver.ApplyTemplate(catalog, SettingsResolver.Defaults(catalog), template), key, SavedTemplateId: null, time.GetUtcNow()));
    }
}
