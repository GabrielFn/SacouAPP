using Xunit;

namespace Sacou.Architecture.Tests;

internal static class ViolationAssert
{
    /// <summary>Fails listing every violation; Assert.Empty truncates long collections.</summary>
    internal static void None<T>(IEnumerable<T> violations)
    {
        var lines = violations.Select(violation => $"- {violation}").ToList();
        if (lines.Count > 0)
        {
            Assert.Fail($"{lines.Count} violation(s):{Environment.NewLine}{string.Join(Environment.NewLine, lines)}");
        }
    }
}
