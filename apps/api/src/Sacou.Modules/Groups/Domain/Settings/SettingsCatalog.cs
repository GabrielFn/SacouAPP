using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>
/// The fields and the ready-made templates of packages/match-engine/src/settings/settings-catalog.json,
/// the single source shared with TypeScript. Infrastructure reads the file; the domain gets it ready.
/// </summary>
internal sealed class SettingsCatalog
{
    public const int SchemaVersion = 1;

    /// <summary>The ready-made templates, in the order of screen 04. Names in pt-BR live in the app.</summary>
    public static readonly ImmutableArray<string> TemplateKeys = ["pelada", "racha-organizado", "treino", "areia-rei-da-quadra", "do-zero"];

    public SettingsCatalog(ImmutableArray<SettingsField> fields, ImmutableArray<SettingsTemplate> templates)
    {
        Fields = fields;
        Templates = templates;
        Blocks = [.. fields.Select(field => field.Block).Distinct(StringComparer.Ordinal)];
    }

    public ImmutableArray<SettingsField> Fields { get; }

    public ImmutableArray<SettingsTemplate> Templates { get; }

    /// <summary>In the order of the catalog.</summary>
    public ImmutableArray<string> Blocks { get; }

    public IEnumerable<SettingsField> FieldsOf(string block) =>
        Fields.Where(field => string.Equals(field.Block, block, StringComparison.Ordinal));

    public SettingsTemplate? TemplateOf(string key) =>
        Templates.FirstOrDefault(template => string.Equals(template.Key, key, StringComparison.Ordinal));
}
