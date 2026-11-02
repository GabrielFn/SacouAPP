using System.Text.Json;
using Xunit;

namespace Sacou.Tests.Golden;

/// <summary>
/// Compiled into each test project that reads the shared golden files. Failure messages name the
/// case and the field, never the value, because a Pix case holds keys and payloads.
/// </summary>
internal static class GoldenFile
{
    /// <summary>Unlike JavaScript, which keeps the last one, a repeated key fails here (ADR 0025).</summary>
    private static readonly JsonDocumentOptions StrictOptions = new() { AllowDuplicateProperties = false };

    public static JsonElement ParseStrict(string json)
    {
        using var document = JsonDocument.Parse(json, StrictOptions);
        return document.RootElement.Clone();
    }

    /// <summary>Reads a file embedded by the test project under the logical name <c>golden/&lt;file&gt;</c>.</summary>
    public static IReadOnlyList<JsonElement> ReadEmbeddedCases(string fileName)
    {
        var resource = $"golden/{fileName}";
        using var stream = typeof(GoldenFile).Assembly.GetManifestResourceStream(resource)
            ?? throw new InvalidOperationException($"Embedded resource \"{resource}\" not found.");
        using var document = JsonDocument.Parse(stream, StrictOptions);
        return [.. document.RootElement.Clone().EnumerateArray()];
    }

    public static string IdOf(JsonElement goldenCase) => Text(goldenCase, "id");

    /// <summary>Each id of a literal list has exactly one case: an absent id fails its own test.</summary>
    public static JsonElement SingleCase(IEnumerable<JsonElement> cases, Func<JsonElement, string> idOf, string id)
    {
        var matches = cases.Where(goldenCase => idOf(goldenCase) == id).ToList();
        Assert.True(matches.Count == 1, $"Expected one case with id \"{id}\", found {matches.Count}.");
        return matches[0];
    }

    /// <summary>The list is written by hand, never read from the file: a case lost from the file must fail.</summary>
    public static void AssertListMatchesFile(IReadOnlyCollection<string> literalIds, IReadOnlyCollection<string> idsInFile)
    {
        var missing = literalIds.Except(idsInFile).ToList();
        var unlisted = idsInFile.Except(literalIds).ToList();
        var duplicated = literalIds.Concat(idsInFile.Distinct())
            .GroupBy(id => id)
            .Where(group => group.Count() > (idsInFile.Contains(group.Key) ? 2 : 1))
            .Select(group => group.Key)
            .Concat(idsInFile.GroupBy(id => id).Where(group => group.Count() > 1).Select(group => group.Key))
            .Distinct()
            .ToList();

        Assert.True(
            missing.Count == 0 && unlisted.Count == 0 && duplicated.Count == 0,
            $"missing: [{string.Join(", ", missing)}]; unlisted: [{string.Join(", ", unlisted)}]; duplicated: [{string.Join(", ", duplicated)}]");
    }

    public static void AssertOnlyFields(JsonElement record, IReadOnlySet<string> allowed, string context)
    {
        Assert.True(record.ValueKind == JsonValueKind.Object, $"{context}: expected an object.");
        var unknown = record.EnumerateObject().Select(member => member.Name).Where(name => !allowed.Contains(name)).ToList();
        Assert.True(unknown.Count == 0, $"{context}: fields outside the schema: {string.Join(", ", unknown)}");
    }

    /// <summary>Numbers always go through a double, as in JavaScript: <c>25.0</c> is 25.</summary>
    public static double Number(JsonElement value, string context)
    {
        var isFinite = value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number);
        Assert.True(isFinite, $"{context}: expected a finite number.");
        return value.GetDouble();
    }

    public static string Text(JsonElement record, string field)
    {
        Assert.True(record.TryGetProperty(field, out var value), $"Missing field \"{field}\".");
        Assert.True(value.ValueKind == JsonValueKind.String, $"Field \"{field}\" must be a string.");
        return value.GetString()!;
    }

    /// <summary>Equality by bits, the same test as ADR 0006 asks. Neither precision nor Equals, which takes NaN as equal to NaN.</summary>
    public static void AssertExact(double expected, double actual, string context)
    {
        Assert.True(
            BitConverter.DoubleToInt64Bits(expected) == BitConverter.DoubleToInt64Bits(actual),
            $"{context}: expected {expected:R}, got {actual:R}.");
    }
}
