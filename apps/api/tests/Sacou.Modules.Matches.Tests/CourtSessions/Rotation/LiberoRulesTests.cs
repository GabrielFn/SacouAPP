using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Alignment;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.Domain.Overlap;
using Sacou.Modules.Matches.FormationCatalogs;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Rotation;

/// <summary>Port of the pure parts of <c>libero.test.ts</c>.</summary>
public sealed class LiberoRulesTests
{
    private const string LiberoMember = "a0000000-0000-4000-8000-000000000007";
    private const int FrontZone4Index = 3;

    /// <summary>MB1 and MB2: what the libero covers in the app, alternating.</summary>
    private static readonly ImmutableArray<int> Middles = [2, 5];

    private static readonly FormationCatalog Catalog = EmbeddedFormationCatalog.Load();

    public static TheoryData<string, int, string> Combinations()
    {
        var data = new TheoryData<string, int, string>();
        foreach (var system in LiberoRules.LiberoSystems)
        {
            foreach (var zone in RotationRules.SetterZoneSequence)
            {
                foreach (var phase in FormationPhase.All)
                {
                    data.Add(system.Code, zone, phase.Code);
                }
            }
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Combinations))]
    public void Libero_PlaysOnlyInTheBackRow_AndNeverServes(string system, int zone, string phase)
    {
        var (state, formationPhase) = StateOf(system, zone, phase);

        var slot = LiberoRules.GetLiberoSlot(state, formationPhase);
        var onCourt = LiberoRules.GetOnCourtBySlot(state, formationPhase);

        Assert.True(slot is null || LiberoRules.BackRowSlots.Contains(slot));
        Assert.NotEqual(LiberoMember, RotationRules.GetServingPlayer(state.Lineup, state.SetterZone));
        if (formationPhase == FormationPhase.Serving)
        {
            Assert.NotEqual(LiberoMember, onCourt[0]);
        }

        Assert.True(onCourt.Count(memberId => memberId == LiberoMember) <= 1);
        Assert.Equal(RotationRules.GetLineupBySlot(state.Lineup, state.SetterZone)[FrontZone4Index], onCourt[FrontZone4Index]);
    }

    [Theory]
    [MemberData(nameof(Combinations))]
    public void LiberoSlot_IsTheLiberoOfTheCatalog_ForTheMiddles(string system, int zone, string phase)
    {
        var (state, formationPhase) = StateOf(system, zone, phase);
        var zoneFormation = AlignmentTables.ZoneFormations[state.System][zone];
        var formation = Catalog.GetFormation(state.System, zoneFormation.FormationKey, formationPhase)!;

        var catalogSlot = RotationSlot.All.FirstOrDefault(slot => formation.Slots[slot].Role == PlayerRole.Libero);

        Assert.Equal(catalogSlot, LiberoRules.GetLiberoSlot(state, formationPhase));
    }

    [Theory]
    [MemberData(nameof(Combinations))]
    public void Libero_OnlySwapsWithTheMemberItCovers(string system, int zone, string phase)
    {
        var (state, formationPhase) = StateOf(system, zone, phase);
        var onCourt = LiberoRules.GetOnCourtBySlot(state, formationPhase);
        var lineupBySlot = RotationRules.GetLineupBySlot(state.Lineup, state.SetterZone);
        var slot = LiberoRules.GetLiberoSlot(state, formationPhase);

        var changed = RotationSlot.All.Where((_, index) => onCourt[index] != lineupBySlot[index]);

        Assert.Equal(slot is null ? [] : [slot], changed);
    }

    [Theory]
    [MemberData(nameof(Combinations))]
    public void Libero_KeepsTheSetterAndThePoints_AndPassesTheValidator(string system, int zone, string phase)
    {
        var (state, formationPhase) = StateOf(system, zone, phase);

        var withLibero = ServeAlignmentRules.GetServeAlignment(Catalog, state, formationPhase);
        var withoutLibero = ServeAlignmentRules.GetServeAlignment(Catalog, state with { Libero = null }, formationPhase);

        Assert.Equal(withoutLibero.ActingSetter, withLibero.ActingSetter);
        Assert.Equal(withoutLibero.Slots.Select(slot => slot.Point), withLibero.Slots.Select(slot => slot.Point));
        var positions = new CourtPositions(withLibero.Slots.ToImmutableDictionary(slot => slot.Slot, slot => slot.Point));
        Assert.IsType<OverlapResult.Passed>(OverlapValidator.Validate(positions, OverlapRuleMode.Fivb2025To28, formationPhase));
        var liberoSlot = LiberoRules.GetLiberoSlot(state, formationPhase);
        Assert.Equal(
            liberoSlot is null ? [] : [liberoSlot],
            withLibero.Slots.Where(slot => slot.Role == PlayerRole.Libero).Select(slot => slot.Slot));
    }

    [Fact]
    public void OnePosition_IsCoveredOnlyWhileThatMemberIsInTheBackRow()
    {
        var outZones = RotationRules.SetterZoneSequence.Where(zone =>
            LiberoRules.GetLiberoSlot(State(FormationSystem.FiveOne, zone, [4]), FormationPhase.Receiving) is null);

        Assert.Equal([6, 5, 4], outZones);
    }

    [Fact]
    public void CoveringOnlyMb2_IsNotReadFromTheCatalog()
    {
        Assert.Null(LiberoRules.GetLiberoSlot(State(FormationSystem.FiveOne, 5, [5]), FormationPhase.Receiving));
    }

    [Fact]
    public void Libero_IsAllowedOnlyIn5x1And6x2_AndNeverOnASetter()
    {
        var middles = new TeamLibero(LiberoMember, Middles);

        Assert.True(LiberoRules.IsLiberoAllowed(FormationSystem.FiveOne, middles));
        Assert.True(LiberoRules.IsLiberoAllowed(FormationSystem.SixTwo, middles));
        Assert.False(LiberoRules.IsLiberoAllowed(FormationSystem.FourTwo, middles));
        Assert.False(LiberoRules.IsLiberoAllowed(FormationSystem.Livre, middles));
        Assert.True(LiberoRules.IsLiberoAllowed(FormationSystem.FourTwo, null));
        Assert.False(LiberoRules.IsLiberoAllowed(FormationSystem.FiveOne, new TeamLibero(LiberoMember, [0])));
        Assert.True(LiberoRules.IsLiberoAllowed(FormationSystem.FiveOne, new TeamLibero(LiberoMember, [3])));
        Assert.False(LiberoRules.IsLiberoAllowed(FormationSystem.SixTwo, new TeamLibero(LiberoMember, [3])));
    }

    [Theory]
    [InlineData(new[] { 2 }, true)]
    [InlineData(new[] { 2, 5 }, true)]
    [InlineData(new[] { 0, 3 }, true)]
    [InlineData(new[] { 5, 2 }, false)]
    [InlineData(new[] { 1, 2 }, false)]
    [InlineData(new[] { 2, 5, 1 }, false)]
    [InlineData(new int[0], false)]
    [InlineData(new[] { 6 }, false)]
    [InlineData(new[] { -1 }, false)]
    public void Coverage_IsOneIndexOrADiagonal_InAscendingOrder(int[] replacedIndexes, bool expected)
    {
        Assert.Equal(expected, LiberoRules.IsLiberoCoverage([.. replacedIndexes]));
    }

    private static (TeamState State, FormationPhase Phase) StateOf(string system, int zone, string phase) =>
        (State(FormationSystem.All.Single(candidate => candidate.Code == system), zone, Middles),
            FormationPhase.All.Single(candidate => candidate.Code == phase));

    private static TeamState State(FormationSystem system, int zone, ImmutableArray<int> replacedIndexes) =>
        new([], new TeamLibero(LiberoMember, replacedIndexes), RotationRulesTests.Lineup, zone, system);
}
