using System.Diagnostics.CodeAnalysis;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>
/// The code in the round's public link, <c>/r/{code}</c> (E3.12, ADR 0070, D1): 22 characters of the Base64url
/// alphabet, made outside the domain from 16 random bytes. A capability to read the round's public summary and to come
/// in as an avulso before the start, never tied to the <see cref="RoundId"/>. <see cref="ToString"/> never prints it,
/// so a log line that formats the value by mistake shows only the type.
/// </summary>
internal sealed record RoundLinkCode
{
    /// <summary>16 bytes in Base64url without padding.</summary>
    public const int Length = 22;

    private RoundLinkCode(string value) => Value = value;

    public string Value { get; }

    /// <summary>A text in the format, or null: a malformed code is refused before any query.</summary>
    public static RoundLinkCode? TryParse(string? text) => IsWellFormed(text) ? new RoundLinkCode(text) : null;

    /// <summary>A code read from the database, where a CHECK holds the format.</summary>
    public static RoundLinkCode FromStored(string value) =>
        TryParse(value) ?? throw new InvalidOperationException("A stored round link code is out of its format.");

    public static bool IsWellFormed([NotNullWhen(true)] string? text) => text is { Length: Length } && text.All(IsBase64UrlCharacter);

    public override string ToString() => nameof(RoundLinkCode);

    private static bool IsBase64UrlCharacter(char character) =>
        char.IsAsciiLetterOrDigit(character) || character is '-' or '_';
}
