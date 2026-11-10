using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Settings;

internal enum SettingsValueType
{
    Boolean,
    Integer,
    Choice,
    Time,
    Text,
}

/// <summary>A leaf of the catalog: its path, its rule, its "Do zero" value and the levels that take it.</summary>
internal sealed record SettingsField(
    string Path,
    string Block,
    string Leaf,
    SettingsValueType Type,
    SettingsValue DefaultValue,
    ImmutableArray<SettingsLevel> Levels,
    bool IsGroupFact,
    bool IsPro)
{
    /// <summary>Only for <see cref="SettingsValueType.Integer"/>.</summary>
    public double Min { get; init; }

    public double Max { get; init; }

    /// <summary>Only for <see cref="SettingsValueType.Choice"/>.</summary>
    public ImmutableArray<SettingsValue> Values { get; init; } = [];

    /// <summary>Only for <see cref="SettingsValueType.Choice"/>: the values that are Pro when the field is not.</summary>
    public ImmutableArray<SettingsValue> ProValues { get; init; } = [];

    /// <summary>Only for <see cref="SettingsValueType.Text"/>: visible characters.</summary>
    public int MaxLength { get; init; }

    public bool IsAllowedAt(SettingsLevel level) => Levels.Contains(level);
}

/// <summary>A copy, never a link: absent leaves that are not facts take "Do zero" when applied.</summary>
internal sealed record SettingsTemplate(string Key, bool IsPro, ImmutableDictionary<string, SettingsValue> Values);
