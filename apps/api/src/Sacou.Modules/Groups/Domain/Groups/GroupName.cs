using System.Buffers;
using System.Collections.Immutable;
using System.Globalization;
using System.Text;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// The name an admin gives the group: trimmed and normalized to NFC, 1 to 60 user-perceived characters
/// (text elements, so an emoji counts as one) and at most 240 code points, the database limit. Nothing
/// invisible: no control, format, direction, unassigned, private-use or lone surrogate code point, no
/// Hangul or Braille filler, a zero-width joiner only inside an emoji sequence, at most 4 combining marks
/// per character and at least one letter, number or symbol. Free text that may name a person ("Racha do
/// João"): never logged (docs/seguranca/dados-pessoais.md).
/// </summary>
internal sealed record GroupName
{
    public const int MaxLength = 60;
    public const int MaxCodePoints = 240;
    public const int MaxMarksPerCharacter = 4;

    private const int ZeroWidthJoiner = 0x200D;

    /// <summary>Letters or symbols by category that render as blank space.</summary>
    private static readonly ImmutableHashSet<int> BlankFillers = [0x115F, 0x1160, 0x3164, 0xFFA0, 0x2800];

    private GroupName(string value) => Value = value;

    public string Value { get; }

    public static Result<GroupName> Create(string? value)
    {
        var trimmed = value?.Trim();
        if (trimmed is null || !IsWellFormed(trimmed))
        {
            return Result.Failure<GroupName>(GroupErrors.NameInvalid);
        }

        var normalized = trimmed.Normalize(NormalizationForm.FormC);
        return IsAllowed(normalized)
            ? Result.Success(new GroupName(normalized))
            : Result.Failure<GroupName>(GroupErrors.NameInvalid);
    }

    /// <summary>
    /// A name read back from the database. It passed <see cref="Create"/> when written, but the rule may have
    /// tightened since: a stored name is shown as it is, never turned into an error.
    /// </summary>
    internal static GroupName FromStored(string stored)
    {
        ArgumentNullException.ThrowIfNull(stored);
        return new GroupName(stored);
    }

    /// <summary>Never print the name: it may identify a person.</summary>
    public override string ToString() => nameof(GroupName);

    private static bool IsAllowed(string text) =>
        HasAllowedLength(text) && HasOnlyVisibleText(text) && HasVisibleContent(text) && HasFewMarksPerCharacter(text);

    /// <summary>No lone surrogate: rune enumeration would silently turn it into U+FFFD.</summary>
    private static bool IsWellFormed(string text)
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

    private static bool HasAllowedLength(string text) =>
        new StringInfo(text).LengthInTextElements is >= 1 and <= MaxLength
        && text.EnumerateRunes().Count() <= MaxCodePoints;

    private static bool HasOnlyVisibleText(string text)
    {
        var runes = text.EnumerateRunes().ToArray();
        return Enumerable.Range(0, runes.Length).All(index => IsVisible(runes, index));
    }

    private static bool IsVisible(Rune[] runes, int index) =>
        runes[index].Value == ZeroWidthJoiner
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

    /// <summary>Spaces, marks and punctuation alone are not a name.</summary>
    private static bool HasVisibleContent(string text) =>
        text.EnumerateRunes().Any(rune => Rune.IsLetter(rune) || Rune.IsNumber(rune) || Rune.IsSymbol(rune));

    /// <summary>Against "zalgo" text, whose stacked marks spill over the lines around it.</summary>
    private static bool HasFewMarksPerCharacter(string text)
    {
        var characters = StringInfo.GetTextElementEnumerator(text);
        while (characters.MoveNext())
        {
            if (characters.GetTextElement().EnumerateRunes().Count(IsMark) > MaxMarksPerCharacter)
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsMark(Rune rune) => Rune.GetUnicodeCategory(rune) is
        UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark;
}
