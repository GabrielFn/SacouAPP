namespace Sacou.Modules.Groups.Contracts;

/// <summary>The <c>format.modality</c> of a round (docs/dominio/configuracao.md): the sand ranks pairs or fours (ADR 0048).</summary>
public enum GameModality
{
    Indoor6x6,
    Beach2x2,
    Beach4x4,
}

/// <summary>
/// The leaves the after-game of a round reads (E3.9, ADR 0071): the modality, whether the MVP of the day shows and
/// comes from the scoreboard, and whether the points of each player count. Typed here, so no other module repeats
/// the codes of the catalog.
/// </summary>
public sealed record SummaryRules(GameModality Modality, bool MvpEnabled, bool MvpByStats, bool IndividualPoints)
{
    /// <summary>
    /// <c>mvp.voting</c>: the group votes for the MVP after the round (ADR 0072). The summary of the scoreboard does not
    /// read it and the projection key does not hash it: turning it on rebuilds nothing.
    /// </summary>
    public bool MvpVoting { get; init; }

    /// <summary>Whether this round has an MVP vote: the MVP shows and the group votes for it.</summary>
    public bool HasMvpVote => MvpEnabled && MvpVoting;
}

/// <summary>The catalog codes of <see cref="GameModality"/> (settings-catalog.json), the only place they are written in C#.</summary>
public static class GameModalities
{
    public const string Indoor6x6Code = "indoor-6x6";
    public const string Beach2x2Code = "beach-2x2";
    public const string Beach4x4Code = "beach-4x4";

    public static bool IsBeach(GameModality modality) => modality is GameModality.Beach2x2 or GameModality.Beach4x4;

    public static string CodeOf(GameModality modality) => modality switch
    {
        GameModality.Indoor6x6 => Indoor6x6Code,
        GameModality.Beach2x2 => Beach2x2Code,
        GameModality.Beach4x4 => Beach4x4Code,
        _ => throw new ArgumentOutOfRangeException(nameof(modality), modality, "Every modality has a catalog code."),
    };

    /// <summary>The modality of a catalog code, or null for any other text.</summary>
    public static GameModality? FromCode(string code) => code switch
    {
        Indoor6x6Code => GameModality.Indoor6x6,
        Beach2x2Code => GameModality.Beach2x2,
        Beach4x4Code => GameModality.Beach4x4,
        _ => null,
    };
}

/// <summary>The summary leaves of a resolved document, by their catalog path.</summary>
internal static class SummaryRulesReader
{
    public static SummaryRules From(Domain.Settings.GroupSettings resolved) => new(
        GameModalities.FromCode(resolved.ValueOf("format.modality").Text)
            ?? throw new InvalidOperationException("A modality outside the catalog."),
        MvpEnabled: resolved.ValueOf("mvp.enabled").Boolean,
        MvpByStats: resolved.ValueOf("mvp.byStats").Boolean,
        IndividualPoints: resolved.ValueOf("mvp.individualPoints").Boolean)
    {
        MvpVoting = resolved.ValueOf("mvp.voting").Boolean,
    };
}
