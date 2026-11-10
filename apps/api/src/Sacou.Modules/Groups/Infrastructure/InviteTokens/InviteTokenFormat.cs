namespace Sacou.Modules.Groups.Infrastructure.InviteTokens;

/// <summary>
/// What a token looks like: 43 characters of the Base64url alphabet, nothing else. Checked before any query,
/// so a malformed token costs no database work and gets the same answer as a dead one.
/// </summary>
internal static class InviteTokenFormat
{
    /// <summary>32 bytes in Base64url without padding.</summary>
    public const int Length = 43;

    public static bool IsValid(string? token) => token is { Length: Length } && token.All(IsBase64UrlCharacter);

    private static bool IsBase64UrlCharacter(char character) =>
        char.IsAsciiLetterOrDigit(character) || character is '-' or '_';
}
