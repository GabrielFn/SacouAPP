using System.Text.Json.Nodes;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Settings;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Modules.Groups.Infrastructure.Settings;
using Sacou.Shared.Members;
using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Contracts;

/// <summary>G1 to G5: <c>ResolveRound</c>, the way the Sessions module reads the settings of a round (ADR 0043, D8).</summary>
public sealed class GroupSettingsReaderTests
{
    private static readonly SettingsCatalog Catalog = SettingsCatalogReader.Catalog;
    private static readonly DateTimeOffset Now = new(2026, 11, 10, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void G1_ALayerLeaf_WinsAsRound_AndTheRestComesFromTheGroup()
    {
        var settings = Reader().ResolveRound(Snapshot(), """{"schemaVersion":1,"scoring":{"bestOf":3}}""").Value;

        var resolved = JsonNode.Parse(settings.ResolvedJson)!;
        Assert.Equal(3, (int)resolved["scoring"]!["bestOf"]!);
        Assert.Equal("round", settings.Sources["scoring.bestOf"]);
        Assert.Equal("group", settings.Sources["scoring.pointsPerSet"]);
        Assert.Equal(25, (int)resolved["scoring"]!["pointsPerSet"]!);
        Assert.Equal("""{"schemaVersion":1,"scoring":{"bestOf":3}}""", settings.LayerJson);
    }

    [Fact]
    public void G2_ALeafEqualToTheGroup_IsNormalizedAway_AndAnEmptyLayerBecomesNull()
    {
        var group = Snapshot();

        var same = Reader().ResolveRound(group, """{"schemaVersion":1,"scoring":{"bestOf":1,"pointsPerSet":21}}""").Value;
        var onlyEqual = Reader().ResolveRound(group, """{"schemaVersion":1,"scoring":{"bestOf":1}}""").Value;

        Assert.Equal("""{"schemaVersion":1,"scoring":{"pointsPerSet":21}}""", same.LayerJson);
        Assert.Null(onlyEqual.LayerJson);
        Assert.Null(Reader().ResolveRound(group, null).Value.LayerJson);
        Assert.Equal("group", onlyEqual.Sources["scoring.bestOf"]);
    }

    [Theory]
    [InlineData("""{"schemaVersion":1,"schedule":{"weekday":2}}""")]
    [InlineData("""{"schemaVersion":1,"money":{"monthlyFeeCents":2000}}""")]
    [InlineData("""{"schemaVersion":1,"attendance":{"regularsEnabled":true}}""")]
    [InlineData("""{"schemaVersion":1,"scoring":{"bestOf":2}}""")]
    [InlineData("""{"scoring":{"bestOf":3}}""")]
    [InlineData("""{"schemaVersion":1,""")]
    [InlineData("[]")]
    [InlineData("")]
    public void G3_ALayerBreakingTheCatalog_IsSettingsInvalid_WithoutThePath(string layer)
    {
        var result = Reader().ResolveRound(Snapshot(), layer);

        Assert.True(result.IsFailure);
        Assert.Equal("groups.settings-invalid", result.Error.Code);
        Assert.Equal(ErrorKind.Validation, result.Error.Kind);
    }

    [Fact]
    public void G4_AttendanceRules_ComeFromTheResolvedDocument_AndRegularsFromTheGroupAlone()
    {
        var group = Snapshot(("attendance.regularsEnabled", true), ("attendance.waitlistEnabled", true), ("attendance.capacityLimited", true), ("attendance.enabled", true));

        var rules = Reader().ResolveRound(group, """{"schemaVersion":1,"attendance":{"capacity":14,"dropInWindowEnabled":true,"dropInOpensHoursBefore":24}}""").Value.Attendance;

        Assert.Equal(new AttendanceRules(true, true, 14, true, true, true, 24), rules);
        Assert.Equal(12, Reader().ResolveRound(group, null).Value.Attendance.Capacity);
        Assert.False(Reader().ResolveRound(Snapshot(), null).Value.Attendance.RegularsEnabled);
    }

    [Theory]
    [InlineData("indoor-6x6", 6)]
    [InlineData("beach-4x4", 4)]
    [InlineData("beach-2x2", 2)]
    public void DrawRules_ComeFromTheResolvedDocument_AndTheModalityGivesTheTeamSize(string modality, int playersPerTeam)
    {
        var group = Snapshot(("draw.enabled", true));

        var rules = Reader().ResolveRound(group, $$$"""{"schemaVersion":1,"draw":{"balanceByLevel":true},"format":{"modality":"{{{modality}}}"}}""").Value.Draw;

        Assert.Equal(new DrawRules(true, true, playersPerTeam), rules);
        Assert.Equal(new DrawRules(false, false, 6), Reader().ResolveRound(Snapshot(), null).Value.Draw);
    }

    [Fact]
    public void G5_TheGroupIsReadAtEveryUse_SoARoundWithoutTheLeafSeesTheNewValue()
    {
        var layer = """{"schemaVersion":1,"scoring":{"pointsPerSet":15}}""";
        var before = Reader().ResolveRound(Snapshot(), layer).Value;
        var after = Reader().ResolveRound(Snapshot(("scoring.pointsPerSet", 21d)), layer).Value;
        var inherits = Reader().ResolveRound(Snapshot(("scoring.pointsPerSet", 21d)), null).Value;

        Assert.Equal(15, (int)JsonNode.Parse(after.ResolvedJson)!["scoring"]!["pointsPerSet"]!);
        Assert.Equal(15, (int)JsonNode.Parse(before.ResolvedJson)!["scoring"]!["pointsPerSet"]!);
        Assert.Equal(21, (int)JsonNode.Parse(inherits.ResolvedJson)!["scoring"]!["pointsPerSet"]!);
    }

    [Fact]
    public async Task GetAsync_ReadsTheStoredDocument_AndAnUnknownGroupIsNull()
    {
        var stored = SettingsRowMapping.Default(Now);
        var reader = new StoreGroupSettingsReader(new FakeSettingsStore(stored));

        Assert.NotNull(await reader.GetAsync(Guid.NewGuid(), CancellationToken.None));
        Assert.Null(await new StoreGroupSettingsReader(new FakeSettingsStore(null)).GetAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public void TheSnapshot_NeverPrintsTheSettings()
    {
        Assert.Equal("GroupSettingsSnapshot", Snapshot().ToString());
    }

    private static StoreGroupSettingsReader Reader() => new(new FakeSettingsStore(null));

    private static GroupSettingsSnapshot Snapshot(params (string Path, object Value)[] changes)
    {
        var values = changes.Aggregate(
            SettingsResolver.Defaults(Catalog).Values,
            (current, change) => current.SetItem(change.Path, change.Value switch
            {
                bool flag => SettingsValue.Of(flag),
                double number => SettingsValue.Of(number),
                _ => throw new ArgumentOutOfRangeException(nameof(changes)),
            }));
        return new GroupSettingsSnapshot(new GroupSettings(values));
    }

    private sealed class FakeSettingsStore(StoredSettings? stored) : IGroupSettingsStore
    {
        public Task<StoredSettings?> FindAsync(GroupId group, CancellationToken cancellationToken) => Task.FromResult(stored);

        public Task<IReadOnlyList<TemplateSummary>> ListTemplatesAsync(GroupId group, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Result<SettingsChange>> ExecuteInSettingsLockAsync(
            GroupId group, MemberId actor, Func<SettingsState, Result<SettingsChange>> change, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
