using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Contracts;

internal sealed class StoreGroupSettingsReader(IGroupSettingsStore store) : IGroupSettingsReader
{
    private static SettingsCatalog Catalog => SettingsCatalogReader.Catalog;

    public async Task<GroupSettingsSnapshot?> GetAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var stored = await store.FindAsync(new GroupId(groupId), cancellationToken).ConfigureAwait(false);
        return stored is null ? null : new GroupSettingsSnapshot(stored.Settings);
    }

    public Result<RoundSettings> ResolveRound(GroupSettingsSnapshot group, string? roundLayerJson)
    {
        ArgumentNullException.ThrowIfNull(group);
        var layer = ParseLayer(roundLayerJson);
        if (layer is null)
        {
            return Result.Failure<RoundSettings>(GroupErrors.SettingsInvalid);
        }

        var normalized = SettingsResolver.Normalize(group.Settings, layer);
        var resolved = SettingsResolver.Resolve(Catalog, group.Settings, normalized);
        return Result.Success(new RoundSettings(
            normalized.ChangeCount == 0 ? null : SettingsJsonWriter.Write(SettingsTree.ToNode(Catalog, normalized)),
            SettingsJsonWriter.Write(SettingsTree.ToNode(Catalog, resolved.Values)),
            resolved.Sources.ToImmutableDictionary(source => source.Key, source => source.Value.Code, StringComparer.Ordinal),
            AttendanceRulesReader.From(resolved.Values),
            DrawRulesReader.From(resolved.Values),
            FormatRulesReader.From(resolved.Values),
            SummaryRulesReader.From(resolved.Values)));
    }

    /// <summary>Null means refused: malformed JSON and every parser refusal look the same from outside.</summary>
    private static SettingsLayer? ParseLayer(string? json)
    {
        if (json is null)
        {
            return SettingsLayer.Empty;
        }

        try
        {
            var parsed = SettingsParser.ParseLayer(Catalog, SettingsLevel.Round, SettingsJsonReader.Parse(json));
            return parsed.IsSuccess ? parsed.Value : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
