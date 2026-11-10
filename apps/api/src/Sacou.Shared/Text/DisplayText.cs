using System.Buffers;
using System.Globalization;
using System.Text;

namespace Sacou.Shared.Text;

/// <summary>
/// The pieces of the free-text rule shared by the group name and the settings text (the venue): nothing
/// invisible, at least one letter, number or symbol, and no lone surrogate. The TypeScript twin is
/// packages/match-engine/src/settings/display-text.ts (ADR 0041).
/// </summary>
public static class DisplayText
{
    private const int ZeroWidthJoiner = 0x200D;

    /// <summary>Letters or symbols by category that render as blank space.</summary>
    private static readonly HashSet<int> BlankFillers = [0x115F, 0x1160, 0x3164, 0xFFA0, 0x2800];

    /// <summary>No lone surrogate: rune enumeration would silently turn it into U+FFFD.</summary>
    public static bool IsWellFormed(string text)
    {
        var rest = text.AsSpan();
        while (!rest.IsEmpty)
        {
            if (Rune.DecodeFromUtf16(rest, out _, out var consumed) != OperationStatus.Done)
            {
                return false;
            }

            rest = rest[consumed..];
        }

        return true;
    }

    /// <summary>
    /// No control, format, direction, unassigned, private-use or surrogate code point, no Hangul or Braille
    /// filler, and a zero-width joiner only inside an emoji sequence.
    /// </summary>
    public static bool HasOnlyVisibleText(string text)
    {
        var runes = text.EnumerateRunes().ToArray();
        return Enumerable.Range(0, runes.Length).All(index => IsVisible(runes, index));
    }

    /// <summary>Spaces, marks and punctuation alone are not text.</summary>
    public static bool HasVisibleContent(string text) =>
        text.EnumerateRunes().Any(rune => Rune.IsLetter(rune) || Rune.IsNumber(rune) || Rune.IsSymbol(rune));

    /// <summary>
    /// The rule of a name (a group, a saved template): at most <paramref name="maxElements"/> user-perceived
    /// characters, <paramref name="maxCodePoints"/> code points and <paramref name="maxMarks"/> combining marks
    /// per character, all visible, with some letter, number or symbol. The text is already trimmed and in NFC.
    /// </summary>
    public static bool IsAllowedName(string text, int maxElements, int maxCodePoints, int maxMarks)
    {
        var elements = new StringInfo(text).LengthInTextElements;
        return elements >= 1 && elements <= maxElements
            && text.EnumerateRunes().Count() <= maxCodePoints
            && HasOnlyVisibleText(text) && HasVisibleContent(text) && HasFewMarksPerCharacter(text, maxMarks);
    }

    public static bool IsMark(Rune rune) => Rune.GetUnicodeCategory(rune) is
        UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark;

    public static bool IsZeroWidthJoiner(Rune rune) => rune.Value == ZeroWidthJoiner;

    /// <summary>Against "zalgo" text, whose stacked marks spill over the lines around it.</summary>
    private static bool HasFewMarksPerCharacter(string text, int maxMarks)
    {
        var characters = StringInfo.GetTextElementEnumerator(text);
        while (characters.MoveNext())
        {
            if (characters.GetTextElement().EnumerateRunes().Count(IsMark) > maxMarks)
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsVisible(Rune[] runes, int index) =>
        IsZeroWidthJoiner(runes[index])
            ? JoinsEmoji(runes, index)
            : !BlankFillers.Contains(runes[index].Value) && !IsHidden(Rune.GetUnicodeCategory(runes[index]));

    private static bool IsHidden(UnicodeCategory category) => category is
        UnicodeCategory.Control or UnicodeCategory.Format
        or UnicodeCategory.LineSeparator or UnicodeCategory.ParagraphSeparator
        or UnicodeCategory.OtherNotAssigned or UnicodeCategory.PrivateUse or UnicodeCategory.Surrogate;

    /// <summary>An emoji, its skin tone or its variation selector before; an emoji after.</summary>
    private static bool JoinsEmoji(Rune[] runes, int index) =>
        index > 0 && index < runes.Length - 1
        && Rune.GetUnicodeCategory(runes[index - 1]) is UnicodeCategory.OtherSymbol or UnicodeCategory.ModifierSymbol or UnicodeCategory.NonSpacingMark
        && Rune.GetUnicodeCategory(runes[index + 1]) is UnicodeCategory.OtherSymbol;
}
