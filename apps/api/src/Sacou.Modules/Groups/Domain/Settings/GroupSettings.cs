using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>The complete document of a group: every leaf of the catalog has a value. Made only by the parser and the functions here.</summary>
internal sealed class GroupSettings
{
    internal GroupSettings(ImmutableDictionary<string, SettingsValue> values) => Values = values;

    public ImmutableDictionary<string, SettingsValue> Values { get; }

    public SettingsValue ValueOf(string path) =>
        Values.TryGetValue(path, out var value) ? value : throw new InvalidOperationException($"No leaf \"{path}\".");

    /// <summary>The venue may name a person: never printed.</summary>
    public override string ToString() => nameof(GroupSettings);
}

/// <summary>A partial layer of a round or a match: an absent leaf inherits.</summary>
internal sealed class SettingsLayer
{
    public static readonly SettingsLayer Empty = new(ImmutableDictionary<string, SettingsValue>.Empty);

    internal SettingsLayer(ImmutableDictionary<string, SettingsValue> values) => Values = values;

    public ImmutableDictionary<string, SettingsValue> Values { get; }

    /// <summary>What the round screen shows as "N mudanças".</summary>
    public int ChangeCount => Values.Count;

    public override string ToString() => nameof(SettingsLayer);
}

/// <summary>The resolved document and, by path, where each leaf came from.</summary>
internal sealed record ResolvedSettings(GroupSettings Values, ImmutableDictionary<string, SettingsLevel> Sources);
