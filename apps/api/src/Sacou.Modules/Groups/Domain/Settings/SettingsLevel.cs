using System.Collections.Immutable;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>A level of the settings, which is also the source of a resolved leaf (ADR 0041).</summary>
internal sealed record SettingsLevel
{
    public static readonly SettingsLevel Group = new("group");
    public static readonly SettingsLevel Round = new("round");
    public static readonly SettingsLevel Match = new("match");

    /// <summary>From the least to the most specific: the most specific wins in each leaf.</summary>
    public static readonly ImmutableArray<SettingsLevel> All = [Group, Round, Match];

    private SettingsLevel(string code) => Code = code;

    public string Code { get; }

    public static SettingsLevel? FromCode(string code) =>
        All.FirstOrDefault(level => string.Equals(level.Code, code, StringComparison.Ordinal));
}
