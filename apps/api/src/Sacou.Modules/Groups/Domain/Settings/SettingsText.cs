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
    private const int MaxMarksPerCharacter = DisplayText.MaxMarksPerCharacter;

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
        if (!DisplayText.IsWithinCountedLength(runes, maxLength))
        {
            return SettingsErrors.OutOfRange;
        }

        return IsAllowed(text, runes) ? null : SettingsErrors.InvalidText;
    }

    private static bool IsAllowed(string text, Rune[] runes) =>
        IsCanonical(text)
        && DisplayText.HasOnlyVisibleText(text)
        && DisplayText.HasVisibleContent(text)
        && DisplayText.HasFewMarksInARow(runes, MaxMarksPerCharacter);

    private static bool IsCanonical(string text) =>
        string.Equals(text, text.Trim(), StringComparison.Ordinal)
        && string.Equals(text, text.Normalize(NormalizationForm.FormC), StringComparison.Ordinal);
}
