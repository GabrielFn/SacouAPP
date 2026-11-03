using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// A lowercase UUID in the 8-4-4-4-12 layout, checked character by character. No regex: in .NET,
/// <c>$</c> accepts a trailing line break, which the TypeScript port refuses.
/// </summary>
internal static class LowercaseUuid
{
    private const int Length = 36;
    private const char Hyphen = '-';

    /// <summary>The positions of the hyphens in 8-4-4-4-12.</summary>
    private static readonly ImmutableArray<int> HyphenPositions = [8, 13, 18, 23];

    public static bool IsValid(string text)
    {
        if (text.Length != Length)
        {
            return false;
        }

        for (var index = 0; index < text.Length; index++)
        {
            var isValidCharacter = HyphenPositions.Contains(index)
                ? text[index] == Hyphen
                : IsLowercaseHexDigit(text[index]);
            if (!isValidCharacter)
            {
                return false;
            }
        }

        return true;
    }

    private static bool IsLowercaseHexDigit(char character) =>
        character is (>= '0' and <= '9') or (>= 'a' and <= 'f');
}
