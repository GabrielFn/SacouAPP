using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Http;

internal static class LogAssert
{
    private const int ShortestFragment = 8;

    /// <summary>L1: no log entry carries a token, a segment of one, the subject, the e-mail or the name.</summary>
    public static void HasNoSecrets(CollectingLoggerProvider logs, IEnumerable<string> sent) =>
        HasNoSecrets(logs.Entries, sent);

    public static void HasNoSecrets(IReadOnlyList<string> entries, IEnumerable<string> sent)
    {
        var forbidden = sent
            .Select(value => value.Replace("Bearer ", string.Empty, StringComparison.Ordinal))
            .SelectMany(TestIdTokens.Fragments)
            .Concat([TestIdToken.Subject, TestIdToken.Email, TestIdToken.Name, TestIdToken.Picture])
            .Where(fragment => fragment.Length >= ShortestFragment)
            .Distinct()
            .ToList();

        var leaks = entries.Where(entry => forbidden.Any(fragment => entry.Contains(fragment, StringComparison.Ordinal)));

        Assert.Empty(leaks);
    }
}
