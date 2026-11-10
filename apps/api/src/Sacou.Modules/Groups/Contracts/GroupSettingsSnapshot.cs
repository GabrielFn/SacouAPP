using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The group's settings as read, opaque to other modules: they hand it back to
/// <see cref="IGroupSettingsReader.ResolveRound"/>. The document never leaves the Groups module.
/// </summary>
public sealed class GroupSettingsSnapshot
{
    internal GroupSettingsSnapshot(GroupSettings settings) => Settings = settings;

    internal GroupSettings Settings { get; }

    /// <summary>The settings carry the venue, which may name a person: never printed.</summary>
    public override string ToString() => nameof(GroupSettingsSnapshot);
}
