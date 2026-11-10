using Sacou.Shared.Text;
using System.Text;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>
/// Free text in the settings (the venue): the rule of <c>GroupName</c>, with an empty text allowed and
/// no trimming here (the app trims and normalizes before sending). Characters are counted as code points
/// that are not marks, joiners or skin tones, the same count as TypeScript, which cannot use
/// <c>Intl</c> in the engine (ADR 0041). Never logged: it may name a person.
/// </summary>
internal static class SettingsText
{
    private const int FirstSkinTone = 0x1F3FB;
    private const int LastSkinTone = 0x1F3FF;
    private const int MaxMarksPerCharacter = 4;

    /// <summary>As <c>GroupName</c>: 60 characters, 240 code points.</summary>
    private const int MaxCodePointsPerCharacter = 4;

    /// <summary><c>null</c> when the text passes.</summary>
    public static string? Check(string text, int maxLength)
    {
        if (text.Length == 0)
        {
            return null;
        }

        if (!DisplayText.IsWellFormed(text))
        {
            return SettingsErrors.InvalidText;
        }

        var runes = text.EnumerateRunes().ToArray();
        if (!IsWithinLength(runes, maxLength))
        {
            return SettingsErrors.OutOfRange;
        }

        return IsAllowed(text, runes) ? null : SettingsErrors.InvalidText;
    }

    private static bool IsWithinLength(Rune[] runes, int maxLength) =>
        runes.Count(CountsAsCharacter) <= maxLength && runes.Length <= maxLength * MaxCodePointsPerCharacter;

    private static bool CountsAsCharacter(Rune rune) =>
        !DisplayText.IsZeroWidthJoiner(rune) && rune.Value is < FirstSkinTone or > LastSkinTone && !DisplayText.IsMark(rune);

    private static bool IsAllowed(string text, Rune[] runes) =>
        IsCanonical(text)
        && DisplayText.HasOnlyVisibleText(text)
        && DisplayText.HasVisibleContent(text)
        && HasFewMarksPerCharacter(runes);

    private static bool IsCanonical(string text) =>
        string.Equals(text, text.Trim(), StringComparison.Ordinal)
        && string.Equals(text, text.Normalize(NormalizationForm.FormC), StringComparison.Ordinal);

    /// <summary>Against "zalgo" text: no character carries more than a few marks in a row.</summary>
    private static bool HasFewMarksPerCharacter(Rune[] runes)
    {
        var run = 0;
        foreach (var rune in runes)
        {
            run = DisplayText.IsMark(rune) ? run + 1 : 0;
            if (run > MaxMarksPerCharacter)
            {
                return false;
            }
        }

        return true;
    }
}
