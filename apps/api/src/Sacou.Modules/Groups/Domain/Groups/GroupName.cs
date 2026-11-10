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

    private GroupName(string value) => Value = value;

    public string Value { get; }

    public static Result<GroupName> Create(string? value)
    {
        var trimmed = value?.Trim();
        if (trimmed is null || !DisplayText.IsWellFormed(trimmed))
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
        DisplayText.IsAllowedName(text, MaxLength, MaxCodePoints, MaxMarksPerCharacter);
}
