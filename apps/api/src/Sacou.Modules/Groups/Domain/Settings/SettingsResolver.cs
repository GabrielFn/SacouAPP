using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>Merge, normalization and templates: pure functions, the same as resolve-settings.ts, normalize-layer.ts and apply-template.ts.</summary>
internal static class SettingsResolver
{
    /// <summary>
    /// Merges leaf by leaf: the most specific level wins in each leaf, never a whole block. Never fails
    /// with parsed inputs; conflicts between leaves are for the match rules, not for the merge.
    /// </summary>
    public static ResolvedSettings Resolve(
        SettingsCatalog catalog,
        GroupSettings group,
        SettingsLayer? round = null,
        SettingsLayer? match = null)
    {
        var values = ImmutableDictionary.CreateBuilder<string, SettingsValue>(StringComparer.Ordinal);
        var sources = ImmutableDictionary.CreateBuilder<string, SettingsLevel>(StringComparer.Ordinal);
        foreach (var field in catalog.Fields)
        {
            var (value, source) = WinnerOf(field.Path, group, round, match);
            values.Add(field.Path, value);
            sources.Add(field.Path, source);
        }

        return new ResolvedSettings(new GroupSettings(values.ToImmutable()), sources.ToImmutable());
    }

    /// <summary>
    /// Drops the leaves equal to what the layer would inherit, so "1 mudança" counts right. The parent of a
    /// round is the group; the parent of a match is the group and the round already resolved.
    /// </summary>
    public static SettingsLayer Normalize(GroupSettings parent, SettingsLayer layer) =>
        new(layer.Values.Where(leaf => !Equals(parent.ValueOf(leaf.Key), leaf.Value))
            .ToImmutableDictionary(StringComparer.Ordinal));

    /// <summary>
    /// Copies a template onto a group: every leaf that is not a fact of the group takes the template's value,
    /// or "Do zero" when the template leaves it out. Facts (day, time, venue, capacity, money) stay.
    /// </summary>
    public static GroupSettings ApplyTemplate(SettingsCatalog catalog, GroupSettings current, SettingsTemplate template) =>
        new(catalog.Fields.ToImmutableDictionary(
            field => field.Path,
            field => field.IsGroupFact ? current.ValueOf(field.Path) : template.Values.GetValueOrDefault(field.Path, field.DefaultValue),
            StringComparer.Ordinal));

    /// <summary>"Do zero" in every leaf: the base of a new group before its template.</summary>
    public static GroupSettings Defaults(SettingsCatalog catalog) =>
        new(catalog.Fields.ToImmutableDictionary(field => field.Path, field => field.DefaultValue, StringComparer.Ordinal));

    private static (SettingsValue Value, SettingsLevel Source) WinnerOf(
        string path,
        GroupSettings group,
        SettingsLayer? round,
        SettingsLayer? match)
    {
        if (match is not null && match.Values.TryGetValue(path, out var fromMatch))
        {
            return (fromMatch, SettingsLevel.Match);
        }

        if (round is not null && round.Values.TryGetValue(path, out var fromRound))
        {
            return (fromRound, SettingsLevel.Round);
        }

        return (group.ValueOf(path), SettingsLevel.Group);
    }
}
