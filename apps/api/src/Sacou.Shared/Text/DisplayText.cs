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
    /// <summary>The combining marks a character of a name may carry: the group name, the template name and the nickname share it.</summary>
    public const int MaxMarksPerCharacter = 4;

    private const int ZeroWidthJoiner = 0x200D;

    private const int FirstSkinTone = 0x1F3FB;
    private const int LastSkinTone = 0x1F3FF;

    /// <summary>The settings text count: 4 code points per counted character, as in TypeScript.</summary>
    private const int MaxCodePointsPerCountedCharacter = 4;

    /// <summary>
    /// Characters counted as code points that are not marks, joiners or skin tones (the same count as the
    /// TypeScript twin, which cannot use <c>Intl</c>), and at most 4 code points per allowed character.
    /// </summary>
    public static bool IsWithinCountedLength(Rune[] runes, int maxLength) =>
        runes.Count(CountsAsCharacter) <= maxLength && runes.Length <= maxLength * MaxCodePointsPerCountedCharacter;

    private static bool CountsAsCharacter(Rune rune) =>
        !IsZeroWidthJoiner(rune) && rune.Value is < FirstSkinTone or > LastSkinTone && !IsMark(rune);

    /// <summary>Against "zalgo" text: no character carries more than <paramref name="maxMarks"/> marks in a row.</summary>
    public static bool HasFewMarksInARow(Rune[] runes, int maxMarks)
    {
        var run = 0;
        foreach (var rune in runes)
        {
            run = IsMark(rune) ? run + 1 : 0;
            if (run > maxMarks)
            {
                return false;
            }
        }

        return true;
    }

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
