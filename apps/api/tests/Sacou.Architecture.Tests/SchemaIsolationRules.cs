using System.Text.RegularExpressions;

namespace Sacou.Architecture.Tests;

/// <summary>
/// A2 of E3.4 (ADR 0043, D5 and D9) and G4 of E3.7 (ADR 0060, D14): a module never reads another module's schema;
/// it asks that module's contract. The Sessions never names <c>groups</c>; the Matches never names <c>groups</c>,
/// <c>sessions</c> nor <c>identity</c>. The rule reads the SQL text of the module. It matches text, so it is an
/// alarm against a slip, and the model half of the rule (every entity in the module's own schema) is in the
/// module's tests.
/// </summary>
internal static class SchemaIsolationRules
{
    internal const string ForbiddenSchema = "groups";

    private const RegexOptions Options = RegexOptions.CultureInvariant;

    internal static IReadOnlyList<string> Violations(string file, string source) => Violations(file, source, ForbiddenSchema);

    internal static IReadOnlyList<string> Violations(string file, string source, string schema) =>
        [.. SqlOn(schema).Matches(source).Select(match => $"{file}: {match.Value.Trim()}"),
            .. QuotedName(schema).Matches(source).Select(match => $"{file}: {match.Value}")];

    internal static IReadOnlyList<string> ModuleViolations(string moduleDirectory) => ModuleViolations(moduleDirectory, [ForbiddenSchema]);

    internal static IReadOnlyList<string> ModuleViolations(string moduleDirectory, IReadOnlyList<string> forbiddenSchemas) =>
        [.. from file in Directory.EnumerateFiles(moduleDirectory, "*.cs", SearchOption.AllDirectories)
            where !IsBuildOutput(file)
            let source = File.ReadAllText(file)
            from schema in forbiddenSchemas
            from violation in Violations(Path.GetRelativePath(moduleDirectory, file), source, schema)
            select violation];

    /// <summary>Every line of the module that names <paramref name="text"/>, a table of another module, in any form.</summary>
    internal static IReadOnlyList<string> TextViolations(string moduleDirectory, string text) =>
        [.. from file in Directory.EnumerateFiles(moduleDirectory, "*.cs", SearchOption.AllDirectories)
            where !IsBuildOutput(file)
            from line in File.ReadLines(file)
            where line.Contains(text, StringComparison.OrdinalIgnoreCase)
            select $"{Path.GetRelativePath(moduleDirectory, file)}: {line.Trim()}"];

    private static bool IsBuildOutput(string path) =>
        path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
        || path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal);

    /// <summary><c>FROM groups.members</c>, <c>JOIN "groups"."x"</c>, <c>UPDATE groups.x</c> and the like.</summary>
    private static Regex SqlOn(string schema) =>
        new($@"\b(?:from|join|into|update|table|references)\s+""?{Regex.Escape(schema)}""?\s*\.", Options | RegexOptions.IgnoreCase);

    /// <summary>The schema name as a string literal: <c>HasDefaultSchema("groups")</c>, <c>ToTable("x", "groups")</c>.</summary>
    private static Regex QuotedName(string schema) => new($@"""{Regex.Escape(schema)}""", Options);
}
