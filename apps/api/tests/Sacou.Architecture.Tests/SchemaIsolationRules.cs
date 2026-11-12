using System.Text.RegularExpressions;

namespace Sacou.Architecture.Tests;

/// <summary>
/// A2 of E3.4 (ADR 0043, D5 and D9): the Sessions never reads the <c>groups</c> schema; it asks the Groups'
/// contract. The rule reads the SQL text of the module. It matches text, so it is an alarm against a slip, and
/// the model half of the rule (every entity in the <c>sessions</c> schema) is in the Sessions tests.
/// </summary>
internal static partial class SchemaIsolationRules
{
    internal const string ForbiddenSchema = "groups";

    internal static IReadOnlyList<string> Violations(string file, string source) =>
        [.. SqlOnTheForbiddenSchema().Matches(source).Select(match => $"{file}: {match.Value.Trim()}"),
            .. QuotedSchemaName().Matches(source).Select(match => $"{file}: {match.Value}")];

    internal static IReadOnlyList<string> ModuleViolations(string moduleDirectory) =>
        [.. from file in Directory.EnumerateFiles(moduleDirectory, "*.cs", SearchOption.AllDirectories)
            where !IsBuildOutput(file)
            from violation in Violations(Path.GetRelativePath(moduleDirectory, file), File.ReadAllText(file))
            select violation];

    private static bool IsBuildOutput(string path) =>
        path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
        || path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal);

    /// <summary><c>FROM groups.members</c>, <c>JOIN "groups"."x"</c>, <c>UPDATE groups.x</c> and the like.</summary>
    [GeneratedRegex(@"\b(?:from|join|into|update|table|references)\s+""?groups""?\s*\.", RegexOptions.IgnoreCase)]
    private static partial Regex SqlOnTheForbiddenSchema();

    /// <summary>The schema name as a string literal: <c>HasDefaultSchema("groups")</c>, <c>ToTable("x", "groups")</c>.</summary>
    [GeneratedRegex(@"""groups""")]
    private static partial Regex QuotedSchemaName();
}
