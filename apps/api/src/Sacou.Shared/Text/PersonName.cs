using System.Text;

namespace Sacou.Shared.Text;

/// <summary>
/// The rule of what the group calls a person: the nickname of a player with an account (Identity) and the name of a
/// guest without one (Groups, E3.5) share it, so the two never drift apart (ADR 0051 D1, ADR 0053 D3). Trimmed and
/// normalized to NFC, 1 to 20 user-perceived characters (it fits the player card and the team chip) and at most 80
/// code points, the database limit, with the rule of the group name: nothing invisible, a zero-width joiner only
/// inside an emoji, at most 4 combining marks per character, some letter, number or symbol. Not unique.
/// </summary>
public static class PersonName
{
    public const int MaxLength = 20;
    public const int MaxCodePoints = 80;

    /// <summary>The normalized text when <paramref name="value"/> follows the rule; null when it does not.</summary>
    public static string? Normalize(string? value)
    {
        var trimmed = value?.Trim();
        if (trimmed is null || !DisplayText.IsWellFormed(trimmed))
        {
            return null;
        }

        var normalized = trimmed.Normalize(NormalizationForm.FormC);
        return DisplayText.IsAllowedName(normalized, MaxLength, MaxCodePoints, DisplayText.MaxMarksPerCharacter) ? normalized : null;
    }
}
