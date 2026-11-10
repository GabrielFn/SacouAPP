using System.Text.Json;
using Sacou.Modules.Groups.Access;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.GetGroupSettings;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.UpdateGroupSettings;

/// <summary>Parses the layer first (nothing is locked for a bad body), then merges it on the settings read under the lock.</summary>
internal sealed class UpdateGroupSettingsHandler(IGroupSettingsStore store, TimeProvider time)
{
    public async Task<Result<GroupSettingsResponse>> HandleAsync(GroupAccess access, JsonElement? settings, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var patch = ParsePatch(settings);
        if (patch.IsFailure)
        {
            return Result.Failure<GroupSettingsResponse>(patch.Error);
        }

        var changed = await store.ExecuteInSettingsLockAsync(
            access.GroupId, access.Member.Id, state => Result.Success(Merge(state.Current, patch.Value)), cancellationToken).ConfigureAwait(false);
        return changed.IsSuccess
            ? Result.Success(GroupSettingsResponse.From(changed.Value.Settings))
            : Result.Failure<GroupSettingsResponse>(changed.Error);
    }

    /// <summary>Malformed JSON (a repeated key, a lone surrogate, too deep) is the same refusal as a broken rule.</summary>
    internal static Result<SettingsLayer> ParsePatch(JsonElement? settings)
    {
        if (settings is not { ValueKind: JsonValueKind.Object } body)
        {
            return Result.Failure<SettingsLayer>(GroupErrors.SettingsInvalid);
        }

        try
        {
            var parsed = SettingsParser.ParsePatch(SettingsCatalogReader.Catalog, SettingsJsonReader.Parse(body.GetRawText()));
            return parsed.IsSuccess ? Result.Success(parsed.Value) : Result.Failure<SettingsLayer>(GroupErrors.SettingsInvalid);
        }
        catch (JsonException)
        {
            return Result.Failure<SettingsLayer>(GroupErrors.SettingsInvalid);
        }
    }

    private SettingsChange Merge(StoredSettings current, SettingsLayer patch) =>
        new(current with { Settings = SettingsResolver.ApplyPatch(current.Settings, patch), UpdatedAt = time.GetUtcNow() });
}
