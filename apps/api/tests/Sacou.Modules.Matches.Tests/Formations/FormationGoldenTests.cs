using System.Globalization;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.FormationCatalogs;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.Formations;

public sealed class FormationGoldenTests
{
    private static readonly HashSet<string> CaseFields = ["system", "rotation", "phase", "slots", "liberoReplaces"];
    private static readonly HashSet<string> SlotKeys = ["1", "2", "3", "4", "5", "6"];
    private static readonly HashSet<string> SlotFields = ["role", "x", "y"];

    private static readonly FormationCatalog Catalog = EmbeddedFormationCatalog.Load();

    public static TheoryData<string> CaseIds => new(FormationGoldenIds.All);

    [Fact]
    public void GoldenList_HasTheExactTotal()
    {
        Assert.Equal(FormationGoldenIds.CaseCount, FormationGoldenIds.All.Count);
    }

    [Fact]
    public void GoldenList_MatchesTheFile()
    {
        GoldenFile.AssertListMatchesFile(FormationGoldenIds.All, [.. FormationGoldenIds.Cases.Select(FormationGoldenIds.IdOf)]);
    }

    [Fact]
    public void Catalog_ProducesExactlyTheGoldenFormations_InOrder()
    {
        var produced =
            from system in FormationSystem.All
            from rotation in Catalog.Systems[system].RotationOrder
            from phase in FormationPhase.All
            where Catalog.GetFormation(system, rotation, phase) is not null
            select $"{system.Code}/{rotation.Value}/{phase.Code}";

        Assert.Equal(FormationGoldenIds.All, produced);
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void GetFormation_MatchesTheGoldenCase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(FormationGoldenIds.Cases, FormationGoldenIds.IdOf, id);
        GoldenFile.AssertOnlyFields(goldenCase, CaseFields, id);
        var goldenSlots = goldenCase.GetProperty("slots");
        GoldenFile.AssertOnlyFields(goldenSlots, SlotKeys, id);

        var formation = FormationOf(id);

        foreach (var slot in RotationSlot.All)
        {
            var context = $"{id}/{slot.Value}";
            var goldenSlot = goldenSlots.GetProperty(slot.Value.ToString(CultureInfo.InvariantCulture));
            GoldenFile.AssertOnlyFields(goldenSlot, SlotFields, context);

            var actual = formation.Slots[slot];

            Assert.Equal(GoldenFile.Text(goldenSlot, "role"), actual.Role.Code);
            GoldenFile.AssertExact(GoldenFile.Number(goldenSlot.GetProperty("x"), context), actual.Point.X, $"{context}/x");
            GoldenFile.AssertExact(GoldenFile.Number(goldenSlot.GetProperty("y"), context), actual.Point.Y, $"{context}/y");
        }

        Assert.Equal(goldenCase.GetProperty("liberoReplaces").GetString(), formation.LiberoReplaces?.Code);
    }

    private static Formation FormationOf(string id)
    {
        var parts = id.Split('/');
        var system = FormationSystem.All.Single(candidate => candidate.Code == parts[0]);
        var rotation = RotationKey.All.Single(candidate => candidate.Value.ToString(CultureInfo.InvariantCulture) == parts[1]);
        var phase = FormationPhase.All.Single(candidate => candidate.Code == parts[2]);

        var formation = Catalog.GetFormation(system, rotation, phase);

        Assert.NotNull(formation);
        Assert.Equal(system, formation.System);
        Assert.Equal(rotation, formation.Rotation);
        Assert.Equal(phase, formation.Phase);
        return formation;
    }
}
