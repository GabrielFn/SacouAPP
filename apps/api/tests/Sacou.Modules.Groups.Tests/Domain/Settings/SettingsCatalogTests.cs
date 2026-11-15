using System.Text.Json;
using Sacou.Modules.Groups.Domain;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Xunit;
using static Sacou.Modules.Groups.Tests.Domain.Settings.SettingsGoldenSupport;

namespace Sacou.Modules.Groups.Tests.Domain.Settings;

/// <summary>V10 and V11 on the C# side, and the strict reading of the catalog and of the JSON.</summary>
public sealed class SettingsCatalogTests
{
    /// <summary>Written by hand from the score constants of the engine (ADR 0041): a range changed on one side only fails here or in TypeScript.</summary>
    private static readonly double[] BestOfValues = [1, 3, 5];
    private static readonly double[] WinMarginValues = [1, 2];
    private const int MinSetPoints = 1;
    private const int MaxSetPoints = 99;

    /// <summary>
    /// Written by hand from <c>QueueExitLimits</c> of the Matches module and <c>queue/constants.data.ts</c>
    /// (ADR 0050): a module never sees the internals of another, so the same values are checked against the
    /// engine constants in <c>NextMatchPlannerTests</c> of the Matches module and in <c>settings.test.ts</c>.
    /// </summary>
    private static readonly string[] ExitModeKinds = ["automatic", "whole-team", "fixed-count"];
    private const string DefaultExitMode = "automatic";
    private const int MinFixedExitCount = 1;
    private const int MaxFixedExitCount = 24;
    private const int DefaultFixedExitCount = 2;
    private const int MinWinnerExitWins = 1;
    private const int MaxWinnerExitWins = 10;
    private const int DefaultWinnerExitWins = 3;

    [Fact]
    public void Capacity_IsCappedByTheMembersOfAGroup()
    {
        Assert.Equal(GroupLimits.MaxActiveMembersPerGroup, Field("attendance.capacity").Max);
    }

    [Fact]
    public void ScoringRanges_AreTheOnesOfTheEngine()
    {
        Assert.Equal(BestOfValues, Field("scoring.bestOf").Values.Select(value => value.Number));
        Assert.Equal(WinMarginValues, Field("scoring.winMargin").Values.Select(value => value.Number));
        Assert.All(
            new[] { Field("scoring.pointsPerSet"), Field("scoring.tieBreakPoints") },
            field => Assert.Equal((MinSetPoints, MaxSetPoints), ((int)field.Min, (int)field.Max)));
    }

    [Fact]
    public void QueueModeRanges_AreTheOnesOfTheEngine()
    {
        var exitMode = Field("queue.exitMode");
        var fixedExitCount = Field("queue.fixedExitCount");
        var winnerExitWins = Field("queue.winnerExitWins");

        Assert.Equal(ExitModeKinds, exitMode.Values.Select(value => value.Text));
        Assert.Equal(SettingsValue.Of(DefaultExitMode), exitMode.DefaultValue);
        Assert.Equal((MinFixedExitCount, MaxFixedExitCount), ((int)fixedExitCount.Min, (int)fixedExitCount.Max));
        Assert.Equal(SettingsValue.Of(DefaultFixedExitCount), fixedExitCount.DefaultValue);
        Assert.Equal((MinWinnerExitWins, MaxWinnerExitWins), ((int)winnerExitWins.Min, (int)winnerExitWins.Max));
        Assert.Equal(SettingsValue.Of(DefaultWinnerExitWins), winnerExitWins.DefaultValue);
        Assert.Equal(SettingsValue.Of(false), Field("queue.winnerExitEnabled").DefaultValue);
    }

    [Fact]
    public void Templates_AreTheFiveOfScreen04_AndNoneBringsAFact()
    {
        Assert.Equal(SettingsCatalog.TemplateKeys, Catalog.Templates.Select(template => template.Key));
        Assert.All(Catalog.Templates, template =>
            Assert.DoesNotContain(template.Values.Keys, path => Field(path).IsGroupFact));
    }

    [Fact]
    public void DoZero_HasEveryBlockSwitchedOff()
    {
        var applied = SettingsResolver.ApplyTemplate(Catalog, SettingsResolver.Defaults(Catalog), Catalog.TemplateOf("do-zero")!);
        var switches = Catalog.Fields.Where(field => field.Leaf == "enabled").ToList();

        Assert.NotEmpty(switches);
        Assert.All(switches, field => Assert.Equal(SettingsValue.Of(false), applied.ValueOf(field.Path)));
    }

    [Fact]
    public void EveryTemplateOverDoZero_IsAValidDocument()
    {
        Assert.All(Catalog.Templates, template =>
        {
            var applied = SettingsResolver.ApplyTemplate(Catalog, SettingsResolver.Defaults(Catalog), template);
            Assert.True(SettingsParser.ParseGroupSettings(Catalog, SettingsTree.ToNode(Catalog, applied)).IsSuccess, template.Key);
        });
    }

    [Theory]
    [InlineData("money.monthlyFeeCents", "templates", "pelada", "values")]
    [InlineData("scoring.extra", "templates", "treino", "values")]
    public void TemplateWithAFactOrAnUnknownPath_IsRefused(string path, params string[] keys)
    {
        var node = Edited(keys, path, new NumberNode(1));
        Assert.Throws<InvalidDataException>(() => SettingsCatalogReader.Parse(node));
    }

    [Theory]
    [InlineData("default")]
    [InlineData("groupFact")]
    public void FieldWithABadKey_IsRefused(string key)
    {
        SettingsNode value = key == "default" ? new NumberNode(1) : NullNode.Instance;
        var fields = (ArrayNode)Root().Member("fields")!;
        var capacity = (ObjectNode)fields.Items[2];
        var broken = key == "default" ? Replace(capacity, key, value) : Remove(capacity, key);
        var root = Replace(Root(), "fields", new ArrayNode(fields.Items.SetItem(2, broken)));

        Assert.Throws<InvalidDataException>(() => SettingsCatalogReader.Parse(root));
    }

    [Fact]
    public void RealCatalog_IsRead_PositiveControl()
    {
        Assert.Equal(Catalog.Fields.Length, SettingsCatalogReader.Parse(Root()).Fields.Length);
    }

    [Theory]
    [InlineData("""{ "schemaVersion": 1, "scoring": {}, "scoring": {} }""")]
    [InlineData("""{ "schemaVersion": 1, "scoring": {}, "\u0073coring": {} }""")]
    [InlineData("""{ "schemaVersion": 1, "schedule": { "venue": "Quadra \ud800" } }""")]
    public void RepeatedKeyOrLoneSurrogate_IsMalformedJson(string json)
    {
        Assert.ThrowsAny<JsonException>(() => SettingsJsonReader.Parse(json));
    }

    [Fact]
    public void ResolvedValues_ArePrintedWithoutTheirContent()
    {
        var group = SettingsResolver.Defaults(Catalog);
        Assert.Equal(nameof(GroupSettings), group.ToString());
        Assert.Equal(nameof(SettingsValue), SettingsValue.Of("Quadra do João").ToString());
    }

    private static SettingsField Field(string path) => Catalog.Fields.Single(field => field.Path == path);

    private static ObjectNode Root()
    {
        var assembly = typeof(SettingsCatalogReader).Assembly;
        using var stream = assembly.GetManifestResourceStream(SettingsCatalogReader.ResourceName)!;
        return (ObjectNode)SettingsJsonReader.Parse(stream);
    }

    private static ObjectNode Edited(string[] keys, string leaf, SettingsNode value)
    {
        ObjectNode Walk(ObjectNode node, int depth) => depth == keys.Length
            ? Replace(node, leaf, value)
            : Replace(node, keys[depth], Walk((ObjectNode)node.Member(keys[depth])!, depth + 1));
        return Walk(Root(), 0);
    }

    private static ObjectNode Replace(ObjectNode node, string key, SettingsNode value) =>
        new([.. Remove(node, key).Members, KeyValuePair.Create(key, value)]);

    private static ObjectNode Remove(ObjectNode node, string key) =>
        new([.. node.Members.Where(member => member.Key != key)]);
}
