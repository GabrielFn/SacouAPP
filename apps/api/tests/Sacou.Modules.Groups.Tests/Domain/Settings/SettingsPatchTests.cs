using System.Collections.Immutable;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain.Settings;

/// <summary>M6 and D3 of E3.3 at the domain level: the patch of the group, and the snapshot of a saved template.</summary>
public sealed class SettingsPatchTests
{
    private static readonly SettingsCatalog Catalog = SettingsCatalogReader.Catalog;
    private static readonly GroupSettings Racha = Apply("racha-organizado", SettingsResolver.Defaults(Catalog));

    [Fact]
    public void ParsePatch_TakesAnyLeafOfTheGroup_AndLeavesTheRestOut()
    {
        var patch = ParsePatch("""{"schemaVersion":1,"scoring":{"bestOf":3},"money":{"monthlyFeeCents":2000}}""");

        Assert.True(patch.IsSuccess);
        Assert.Equal(["money.monthlyFeeCents", "scoring.bestOf"], patch.Value.Values.Keys.Order(StringComparer.Ordinal));
    }

    [Theory]
    [InlineData("""{"schemaVersion":1,"scoring":{"bestOf":null}}""", SettingsErrors.WrongType)]
    [InlineData("""{"schemaVersion":1,"scoring":null}""", SettingsErrors.WrongType)]
    [InlineData("""{"schemaVersion":1,"scoring":{"bestOf":2}}""", SettingsErrors.UnknownValue)]
    [InlineData("""{"schemaVersion":1,"scoring":{"unknown":1}}""", SettingsErrors.UnknownField)]
    [InlineData("""{"schemaVersion":1,"templateKey":"treino"}""", SettingsErrors.UnknownField)]
    [InlineData("""{"scoring":{"bestOf":3}}""", SettingsErrors.UnsupportedVersion)]
    [InlineData("""[]""", SettingsErrors.WrongType)]
    public void ParsePatch_RefusesWithTheCatalogCode(string json, string code)
    {
        var patch = ParsePatch(json);

        Assert.False(patch.IsSuccess);
        Assert.Equal(code, patch.Error.Code);
    }

    [Fact]
    public void ApplyPatch_ChangesOnlyTheLeavesItSets()
    {
        var patch = ParsePatch("""{"schemaVersion":1,"scoring":{"bestOf":3}}""").Value;

        var patched = SettingsResolver.ApplyPatch(Racha, patch);

        Assert.Equal(SettingsValue.Of(3d), patched.ValueOf("scoring.bestOf"));
        Assert.All(Catalog.Fields.Where(field => field.Path != "scoring.bestOf"), field => Assert.Equal(Racha.ValueOf(field.Path), patched.ValueOf(field.Path)));
    }

    [Fact]
    public void Snapshot_HoldsNoFact_AndRoundTripsThroughTheSnapshotParser()
    {
        var snapshot = SettingsResolver.Snapshot(Catalog, Racha);
        var text = SettingsJsonWriter.Write(SettingsTree.ToNode(Catalog, snapshot));
        var read = SettingsParser.ParseSnapshot(Catalog, SettingsJsonReader.Parse(text));

        Assert.DoesNotContain(Catalog.Fields.Where(field => field.IsGroupFact), field => snapshot.Values.ContainsKey(field.Path));
        Assert.Equal(Catalog.Fields.Count(field => !field.IsGroupFact), snapshot.Values.Count);
        Assert.True(read.IsSuccess);
        Assert.Equal(snapshot.Values, read.Value.Values);
    }

    [Fact]
    public void ParseSnapshot_RefusesAFact()
    {
        var fact = Catalog.Fields.First(field => field.IsGroupFact);
        var json = SettingsJsonWriter.Write(SettingsTree.ToNode(Catalog, new SettingsLayer(
            ImmutableDictionary<string, SettingsValue>.Empty.Add(fact.Path, fact.DefaultValue))));

        Assert.Equal(SettingsErrors.NotAllowedAtLevel, SettingsParser.ParseSnapshot(Catalog, SettingsJsonReader.Parse(json)).Error.Code);
    }

    /// <summary>D3: applying a snapshot elsewhere reproduces its non-facts and keeps the facts of the target.</summary>
    [Fact]
    public void ApplySnapshot_ReproducesTheNonFacts_AndKeepsTheFacts()
    {
        var snapshot = SettingsResolver.Snapshot(Catalog, Racha);
        var target = SettingsResolver.ApplyPatch(
            Apply("treino", SettingsResolver.Defaults(Catalog)), ParsePatch("""{"schemaVersion":1,"money":{"monthlyFeeCents":2500}}""").Value);

        var applied = SettingsResolver.ApplySnapshot(Catalog, target, snapshot);

        Assert.All(Catalog.Fields.Where(field => !field.IsGroupFact), field => Assert.Equal(Racha.ValueOf(field.Path), applied.ValueOf(field.Path)));
        Assert.All(Catalog.Fields.Where(field => field.IsGroupFact), field => Assert.Equal(target.ValueOf(field.Path), applied.ValueOf(field.Path)));
        Assert.Equal(applied.Values, SettingsResolver.ApplySnapshot(Catalog, applied, snapshot).Values);
    }

    [Fact]
    public void Writer_RoundTripsTheWholeDocument_WithAVenueThatNeedsEscaping()
    {
        var withVenue = SettingsResolver.ApplyPatch(
            Racha, ParsePatch("""{"schemaVersion":1,"schedule":{"venue":"Quadra \"Sol\" 🏐"}}""").Value);

        var text = SettingsJsonWriter.Write(SettingsTree.ToNode(Catalog, withVenue));
        var read = SettingsParser.ParseGroupSettings(Catalog, SettingsJsonReader.Parse(text));

        Assert.True(read.IsSuccess);
        Assert.Equal(withVenue.Values, read.Value.Values);
    }

    private static SettingsResult<SettingsLayer> ParsePatch(string json) =>
        SettingsParser.ParsePatch(Catalog, SettingsJsonReader.Parse(json));

    private static GroupSettings Apply(string key, GroupSettings current) =>
        SettingsResolver.ApplyTemplate(Catalog, current, Catalog.TemplateOf(key)!);
}
