using System.Text.RegularExpressions;

namespace Sacou.Architecture.Tests;

/// <summary>
/// Settings that would weaken the ID token check or leak a token into logs (ADR 0036, D2 and D7). They
/// match text, so they are an alarm against an accidental change, not a barrier against a hostile PR.
/// </summary>
internal static partial class AuthenticationGuardRules
{
    /// <summary>The one file allowed to open endpoints, as a path relative to <c>apps/api/src</c>.</summary>
    internal const string ProgramPath = "Sacou.Api/Program.cs";

    private const string SourceFilePattern = "*.cs";

    /// <summary>Pattern and why it is forbidden. Whitespace inside an assignment does not hide it.</summary>
    private static readonly (string Pattern, string Reason)[] ForbiddenPatterns =
    [
        (@"\bShowPII\b", "logs personal data from IdentityModel"),
        (@"\bLogCompleteSecurityArtifact\b", "logs whole tokens"),
        (@"\bIncludeErrorDetails\b", "tells the client why the token failed"),
        (@"\bTryAllIssuerSigningKeys\s*=\s*true\b", "tries keys of other kids"),
        (@"\bRequireSignedTokens\s*=\s*false\b", "accepts unsigned tokens"),
        (@"\bValidateIssuer\s*=\s*false\b", "skips the issuer"),
        (@"\bValidateAudience\s*=\s*false\b", "skips the audience"),
        (@"\bValidateLifetime\s*=\s*false\b", "skips the expiry"),
        (@"\bSignatureValidator\b", "replaces the signature check"),
    ];

    private static readonly HashSet<string> GeneratedFolders = ["bin", "obj"];

    /// <param name="relativePath">The path below <c>apps/api/src</c>, with forward slashes.</param>
    /// <param name="source">The C# text of that file.</param>
    internal static IReadOnlyList<string> SourceViolations(string relativePath, string source)
    {
        var code = WithoutLineComments(source);
        return
        [
            .. ForbiddenPatterns
                .Where(rule => Regex.IsMatch(code, rule.Pattern))
                .Select(rule => $"{relativePath}: {rule.Pattern} ({rule.Reason})"),
            .. relativePath == ProgramPath || !AllowAnonymousPattern().IsMatch(code)
                ? Array.Empty<string>()
                : [$"{relativePath}: AllowAnonymous outside {ProgramPath} (every exception to the fallback policy is listed there)"],
        ];
    }

    internal static IReadOnlyList<string> DirectoryViolations(string sourceDirectory) =>
        [.. from path in Directory.GetFiles(sourceDirectory, SourceFilePattern, SearchOption.AllDirectories)
            where !Path.GetRelativePath(sourceDirectory, path).Split(Path.DirectorySeparatorChar).Any(GeneratedFolders.Contains)
            from violation in SourceViolations(
                Path.GetRelativePath(sourceDirectory, path).Replace(Path.DirectorySeparatorChar, '/'), File.ReadAllText(path))
            select violation];

    /// <summary>
    /// Known limitation, accepted: this cuts at <c>//</c> even inside a string literal, so a forbidden
    /// fragment after <c>"https://"</c> on the same line would be missed. The guard is an alarm, not a
    /// C# parser; the reviewer reads the authentication code anyway.
    /// </summary>
    private static string WithoutLineComments(string source) =>
        string.Join('\n', source.Split('\n').Select(line => line.Split("//")[0]));

    [GeneratedRegex(@"\bAllowAnonymous\b")]
    private static partial Regex AllowAnonymousPattern();
}
