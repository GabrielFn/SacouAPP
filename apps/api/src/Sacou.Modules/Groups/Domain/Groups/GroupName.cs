using System.Globalization;
using System.Text;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>
/// The name an admin gives the group: trimmed, 1 to 60 user-perceived characters (text elements, so an
/// emoji counts as one) and at most 240 code points, the database limit. No control, invisible format or
/// direction characters; a zero-width joiner only inside an emoji sequence. Free text that may name a
/// person ("Racha do João"): never logged (docs/seguranca/dados-pessoais.md).
/// </summary>
internal sealed record GroupName
{
    public const int MaxLength = 60;
    public const int MaxCodePoints = 240;

    private const int ZeroWidthJoiner = 0x200D;

    private GroupName(string value) => Value = value;

    public string Value { get; }

    public static Result<GroupName> Create(string? value)
    {
        var trimmed = value?.Trim();
        return trimmed is not null && HasAllowedLength(trimmed) && HasOnlyVisibleText(trimmed)
            ? Result.Success(new GroupName(trimmed))
            : Result.Failure<GroupName>(GroupErrors.NameInvalid);
    }

    /// <summary>Never print the name: it may identify a person.</summary>
    public override string ToString() => nameof(GroupName);

    private static bool HasAllowedLength(string text) =>
        new StringInfo(text).LengthInTextElements is >= 1 and <= MaxLength
        && text.EnumerateRunes().Count() <= MaxCodePoints;

    private static bool HasOnlyVisibleText(string text)
    {
        var runes = text.EnumerateRunes().ToArray();
        return Enumerable.Range(0, runes.Length).All(index => IsAllowed(runes, index));
    }

    private static bool IsAllowed(Rune[] runes, int index) =>
        runes[index].Value == ZeroWidthJoiner
            ? JoinsEmoji(runes, index)
            : !IsHidden(Rune.GetUnicodeCategory(runes[index]));

    private static bool IsHidden(UnicodeCategory category) => category is
        UnicodeCategory.Control or UnicodeCategory.Format
        or UnicodeCategory.LineSeparator or UnicodeCategory.ParagraphSeparator;

    /// <summary>An emoji, its skin tone or its variation selector before; an emoji after.</summary>
    private static bool JoinsEmoji(Rune[] runes, int index) =>
        index > 0 && index < runes.Length - 1
        && Rune.GetUnicodeCategory(runes[index - 1]) is UnicodeCategory.OtherSymbol or UnicodeCategory.ModifierSymbol or UnicodeCategory.NonSpacingMark
        && Rune.GetUnicodeCategory(runes[index + 1]) is UnicodeCategory.OtherSymbol;
}
