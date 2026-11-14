using Sacou.Modules.Groups.Domain.Settings;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>The draw leaves of a resolved document, by their catalog path; the modality becomes the size of a team.</summary>
internal static class DrawRulesReader
{
    private const int IndoorPlayers = 6;
    private const int BeachFourPlayers = 4;
    private const int BeachTwoPlayers = 2;

    public static DrawRules From(GroupSettings resolved) => new(
        Enabled: resolved.ValueOf("draw.enabled").Boolean,
        BalanceByLevel: resolved.ValueOf("draw.balanceByLevel").Boolean,
        PlayersPerTeam: PlayersPerTeam(resolved.ValueOf("format.modality").Text));

    /// <summary>The catalog only lets these three through (settings-catalog.json), so any other is a bug.</summary>
    private static int PlayersPerTeam(string modality) => modality switch
    {
        "indoor-6x6" => IndoorPlayers,
        "beach-4x4" => BeachFourPlayers,
        "beach-2x2" => BeachTwoPlayers,
        _ => throw new InvalidOperationException("A modality outside the catalog."),
    };
}
