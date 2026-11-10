using System.Text.Json;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Tests.Golden;
using Xunit;
using static Sacou.Modules.Groups.Tests.Domain.Settings.SettingsGoldenSupport;

namespace Sacou.Modules.Groups.Tests.Domain.Settings;

/// <summary>
/// The shared golden of the settings (plan E3.3, cases S, N and V): the same inputs and the same results as
/// settings.golden.test.ts. Messages name the case and the path, never a value, because the venue is free text.
/// </summary>
public sealed class SettingsGoldenTests
{
    private const string FileName = "settings-resolver.json";
    private const string S10Prefix = "S10-";

    private static readonly Lazy<IReadOnlyList<JsonElement>> Cases = new(() => GoldenFile.ReadEmbeddedCases(FileName));

    public static TheoryData<string> ResolveIds => IdsOf("resolve");

    public static TheoryData<string> NormalizeIds => IdsOf("normalize");

    public static TheoryData<string> ParseGroupIds => IdsOf("parse-group");

    public static TheoryData<string> ParseLayerIds => IdsOf("parse-layer");

    public static TheoryData<string> ApplyTemplateIds => IdsOf("apply-template");

    [Theory]
    [MemberData(nameof(ResolveIds))]
    public void Resolve_MatchesTheGolden(string id)
    {
        var goldenCase = CaseOf(id);
        var group = Group(goldenCase.GetProperty("group"));
        var round = Layer(goldenCase, "round", SettingsLevel.Round);
        var match = Layer(goldenCase, "match", SettingsLevel.Match);
        var changes = goldenCase.GetProperty("expectedChanges");
        var sources = goldenCase.GetProperty("expectedSources");

        var resolved = SettingsResolver.Resolve(Catalog, group, round, match);

        foreach (var field in Catalog.Fields)
        {
            var expectedValue = changes.TryGetProperty(field.Path, out var change) ? Value(change) : group.ValueOf(field.Path);
            var expectedSource = sources.TryGetProperty(field.Path, out var source) ? source.GetString() : SettingsLevel.Group.Code;
            Assert.True(Equals(expectedValue, resolved.Values.ValueOf(field.Path)), $"{id}: value of {field.Path}");
            Assert.True(expectedSource == resolved.Sources[field.Path].Code, $"{id}: source of {field.Path}");
        }

        AssertNormalizationKeepsTheResult(id, group, round, match, resolved);
    }

    [Theory]
    [MemberData(nameof(NormalizeIds))]
    public void Normalize_MatchesTheGolden(string id)
    {
        var goldenCase = CaseOf(id);
        var group = Group(goldenCase.GetProperty("group"));
        var parent = SettingsResolver.Resolve(Catalog, group, Layer(goldenCase, "round", SettingsLevel.Round)).Values;
        var level = SettingsLevel.FromCode(goldenCase.GetProperty("level").GetString()!)!;

        var normalized = SettingsResolver.Normalize(parent, Layer(goldenCase, "layer", level)!);

        Assert.Equal(Describe(Node(goldenCase.GetProperty("expectedLayer"))), Describe(SettingsTree.ToNode(Catalog, normalized)));
        Assert.Equal(goldenCase.GetProperty("expectedChangeCount").GetInt32(), normalized.ChangeCount);
    }

    [Theory]
    [MemberData(nameof(ParseGroupIds))]
    public void ParseGroup_MatchesTheGolden(string id)
    {
        var goldenCase = CaseOf(id);
        var parsed = SettingsParser.ParseGroupSettings(Catalog, RawDocument(goldenCase.GetProperty("document")));
        AssertOutcome(id, goldenCase.GetProperty("expected"), parsed.IsSuccess, parsed.IsSuccess ? null : parsed.Error);
    }

    [Theory]
    [MemberData(nameof(ParseLayerIds))]
    public void ParseLayer_MatchesTheGolden(string id)
    {
        var goldenCase = CaseOf(id);
        var level = SettingsLevel.FromCode(goldenCase.GetProperty("level").GetString()!)!;
        var parsed = SettingsParser.ParseLayer(Catalog, level, Node(goldenCase.GetProperty("layer")));
        var expected = goldenCase.GetProperty("expected");

        AssertOutcome(id, expected, parsed.IsSuccess, parsed.IsSuccess ? null : parsed.Error);
        if (parsed.IsSuccess)
        {
            Assert.Equal(Describe(Node(expected.GetProperty("layer"))), Describe(SettingsTree.ToNode(Catalog, parsed.Value)));
        }
    }

    [Theory]
    [MemberData(nameof(ApplyTemplateIds))]
    public void ApplyTemplate_MatchesTheGolden(string id)
    {
        var goldenCase = CaseOf(id);
        var template = Catalog.TemplateOf(goldenCase.GetProperty("template").GetString()!)!;
        var applied = SettingsResolver.ApplyTemplate(Catalog, Group(goldenCase.GetProperty("group")), template);
        var expected = goldenCase.GetProperty("expectedValues");

        Assert.Equal(Catalog.Fields.Select(field => field.Path), expected.EnumerateObject().Select(leaf => leaf.Name));
        foreach (var leaf in expected.EnumerateObject())
        {
            Assert.True(Equals(Value(leaf.Value), applied.ValueOf(leaf.Name)), $"{id}: value of {leaf.Name}");
        }
    }

    [Fact]
    public void LiteralList_MatchesTheFile()
    {
        GoldenFile.AssertListMatchesFile(
            SettingsGoldenIds.All,
            [.. Cases.Value.Select(GoldenFile.IdOf).Where(id => !id.StartsWith(S10Prefix, StringComparison.Ordinal))]);
    }

    [Fact]
    public void S10_HasOneCasePerLeafAndLevelThatTakesIt()
    {
        var expected = Catalog.Fields.SelectMany(field => field.Levels
            .Where(level => level != SettingsLevel.Group)
            .Select(level => $"{S10Prefix}{level.Code}-{field.Path}"));

        Assert.Equal(expected, Cases.Value.Select(GoldenFile.IdOf).Where(id => id.StartsWith(S10Prefix, StringComparison.Ordinal)));
    }

    [Fact]
    public void OnlyTheMatchRules_AreLeftToTypeScript()
    {
        string[] kinds = ["resolve", "normalize", "derive", "parse-group", "parse-layer", "apply-template"];
        Assert.All(Cases.Value, goldenCase => Assert.Contains(goldenCase.GetProperty("kind").GetString(), kinds));
        Assert.Equal(SettingsGoldenIds.OnlyInTypeScript, IdsWithKind("derive"));
    }

    /// <summary>N2: <c>resolve(g, normalize(g, r)) = resolve(g, r)</c>, and the same for the match.</summary>
    private static void AssertNormalizationKeepsTheResult(
        string id,
        GroupSettings group,
        SettingsLayer? round,
        SettingsLayer? match,
        ResolvedSettings resolved)
    {
        var normalizedRound = round is null ? null : SettingsResolver.Normalize(group, round);
        var roundValues = SettingsResolver.Resolve(Catalog, group, normalizedRound).Values;
        var normalizedMatch = match is null ? null : SettingsResolver.Normalize(roundValues, match);
        var again = SettingsResolver.Resolve(Catalog, group, normalizedRound, normalizedMatch).Values;

        Assert.True(Catalog.Fields.All(field => Equals(again.ValueOf(field.Path), resolved.Values.ValueOf(field.Path))), $"{id}: N2");
    }

    private static void AssertOutcome(string id, JsonElement expected, bool isSuccess, SettingsError? error)
    {
        Assert.True(expected.GetProperty("ok").GetBoolean() == isSuccess, $"{id}: expected ok = {expected.GetProperty("ok")}, got {error}");
        if (error is not null)
        {
            Assert.Equal(expected.GetProperty("code").GetString(), error.Code);
            Assert.Equal(expected.GetProperty("path").GetString(), error.Path);
        }
    }

    private static JsonElement CaseOf(string id) => GoldenFile.SingleCase(Cases.Value, GoldenFile.IdOf, id);

    private static TheoryData<string> IdsOf(string kind) => new(IdsWithKind(kind));

    private static IEnumerable<string> IdsWithKind(string kind) =>
        Cases.Value.Where(goldenCase => goldenCase.GetProperty("kind").GetString() == kind).Select(GoldenFile.IdOf);
}
