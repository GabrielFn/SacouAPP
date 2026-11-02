using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.Domain.Overlap;
using Sacou.Modules.Matches.FormationCatalogs;
using Sacou.Modules.Matches.Tests.Formations;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.Overlap;

/// <summary>The acceptance of ADR 0021: every ready-made formation passes, read from the golden file and from the catalog.</summary>
public sealed class OverlapFormationsTests
{
    private static readonly FormationCatalog Catalog = EmbeddedFormationCatalog.Load();
    private static readonly double?[] Tolerances = [null, 0];

    public static TheoryData<string> CaseIds => new(FormationGoldenIds.All);

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void GoldenFormation_Passes_InEveryModeAndPhase(string id)
    {
        var goldenCase = GoldenFile.SingleCase(FormationGoldenIds.Cases, FormationGoldenIds.IdOf, id);
        var positions = OverlapTestData.PositionsFromGolden(goldenCase.GetProperty("slots"), id);

        foreach (var (mode, phase, tolerance) in EveryModePhaseAndTolerance())
        {
            OverlapTestData.AssertPassed(ExpectedChecked(mode, phase), OverlapValidator.Validate(positions, mode, phase, tolerance));
        }
    }

    [Theory]
    [MemberData(nameof(CaseIds))]
    public void CatalogFormation_Passes_InEveryMode(string id)
    {
        var parts = id.Split('/');
        var system = FormationSystem.All.Single(candidate => candidate.Code == parts[0]);
        var rotation = RotationKey.All.Single(candidate => $"{candidate.Value}" == parts[1]);
        var phase = FormationPhase.All.Single(candidate => candidate.Code == parts[2]);
        var formation = Catalog.GetFormation(system, rotation, phase);
        Assert.NotNull(formation);

        foreach (var (mode, _, tolerance) in EveryModePhaseAndTolerance())
        {
            OverlapTestData.AssertPassed(ExpectedChecked(mode, phase), OverlapValidator.ValidateFormation(formation, mode, tolerance));
        }
    }

    [Fact]
    public void LiberoAtTheNet_CountsInThePlaceTaken()
    {
        var receiving = FormationWithLiberoAtTheNet(FormationPhase.Receiving);
        var serving = FormationWithLiberoAtTheNet(FormationPhase.Serving);

        OverlapTestData.AssertViolated(["1-behind-2"], OverlapValidator.ValidateFormation(receiving, OverlapRuleMode.Classic));
        OverlapTestData.AssertPassed(
            OverlapTestData.WithoutServingPlayer,
            OverlapValidator.ValidateFormation(serving, OverlapRuleMode.Classic));
        Assert.IsType<OverlapResult.InvalidTolerance>(
            OverlapValidator.ValidateFormation(receiving, OverlapRuleMode.Fivb2025To28, tolerance: -1));
    }

    private static IEnumerable<(OverlapRuleMode Mode, FormationPhase Phase, double? Tolerance)> EveryModePhaseAndTolerance() =>
        from mode in OverlapRuleMode.All
        from phase in FormationPhase.All
        from tolerance in Tolerances
        select (mode, phase, tolerance);

    private static IReadOnlyList<string> ExpectedChecked(OverlapRuleMode mode, FormationPhase phase)
    {
        if (phase == FormationPhase.Receiving)
        {
            return OverlapTestData.AllRelations;
        }

        return mode == OverlapRuleMode.Classic ? OverlapTestData.WithoutServingPlayer : [];
    }

    private static Formation FormationWithLiberoAtTheNet(FormationPhase phase)
    {
        var slots = OverlapTestData.BasePoints
            .SetItem(RotationSlot.One, new CourtPoint(0.75, 0.1))
            .ToImmutableDictionary(
                pair => pair.Key,
                pair => new FormationSlot(pair.Key == RotationSlot.One ? PlayerRole.Libero : PlayerRole.Player2, pair.Value));
        return new Formation(FormationSystem.Livre, RotationKey.Zero, phase, slots, LiberoReplaces: null, Note: string.Empty);
    }
}
