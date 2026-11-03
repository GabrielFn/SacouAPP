using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Alignment;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.Domain.Overlap;
using Sacou.Modules.Matches.Tests.CourtSessions.Rotation;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Alignment;

/// <summary>Port of the pure parts of <c>serve-alignment.test.ts</c>.</summary>
public sealed class ServeAlignmentTests
{
    private const int SecondSetterIndex = 3;

    private static readonly ImmutableArray<int> BackRowZones = [1, 6, 5];

    /// <summary>The role each member of the lineup holds, by index (ADR 0026).</summary>
    private static readonly ImmutableDictionary<FormationSystem, ImmutableArray<PlayerRole>> RolesByLineupIndex =
        ImmutableDictionary.CreateRange(
        [
            KeyValuePair.Create<FormationSystem, ImmutableArray<PlayerRole>>(
                FormationSystem.FiveOne,
                [PlayerRole.Setter, PlayerRole.OutsideHitter1, PlayerRole.MiddleBlocker1, PlayerRole.Opposite, PlayerRole.OutsideHitter2, PlayerRole.MiddleBlocker2]),
            KeyValuePair.Create<FormationSystem, ImmutableArray<PlayerRole>>(
                FormationSystem.SixTwo,
                [PlayerRole.Setter1, PlayerRole.OutsideHitter1, PlayerRole.MiddleBlocker1, PlayerRole.Setter2, PlayerRole.OutsideHitter2, PlayerRole.MiddleBlocker2]),
            KeyValuePair.Create<FormationSystem, ImmutableArray<PlayerRole>>(
                FormationSystem.FourTwo,
                [PlayerRole.Setter1, PlayerRole.OutsideHitter1, PlayerRole.MiddleBlocker1, PlayerRole.Setter2, PlayerRole.OutsideHitter2, PlayerRole.MiddleBlocker2]),
        ]);

    public static TheoryData<string, int, string> Combinations()
    {
        var data = new TheoryData<string, int, string>();
        foreach (var system in FormationSystem.All)
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
    public void Alignment_HasThePointsOfTheFormation_AndPassesTheValidator(string system, int zone, string phase)
    {
        var (state, formationPhase) = StateOf(system, zone, phase);

        var alignment = ServeAlignmentRules.GetServeAlignment(AlignmentGolden.Catalog, state, formationPhase);

        var formation = AlignmentGolden.Catalog.GetFormation(state.System, alignment.FormationKey, formationPhase)!;
        Assert.Equal(RotationSlot.All.Select(slot => formation.Slots[slot].Point), alignment.Slots.Select(slot => slot.Point));
        var positions = new CourtPositions(alignment.Slots.ToImmutableDictionary(slot => slot.Slot, slot => slot.Point));
        Assert.All(OverlapRuleMode.All, mode =>
            Assert.IsType<OverlapResult.Passed>(OverlapValidator.Validate(positions, mode, formationPhase)));
    }

    [Theory]
    [MemberData(nameof(Combinations))]
    public void Alignment_PlacesEachMemberOnce_WithTheSetterInItsZone(string system, int zone, string phase)
    {
        var (state, formationPhase) = StateOf(system, zone, phase);

        var alignment = ServeAlignmentRules.GetServeAlignment(AlignmentGolden.Catalog, state, formationPhase);

        Assert.Equal(RotationSlot.All, alignment.Slots.Select(slot => slot.Slot));
        Assert.Equal(state.Lineup.Order(StringComparer.Ordinal), alignment.Slots.Select(slot => slot.MemberId).Order(StringComparer.Ordinal));
        Assert.DoesNotContain(alignment.Slots, slot => slot.Role == PlayerRole.Libero);
        Assert.Equal(state.Lineup[0], alignment.Slots[RotationSlot.All.IndexOf(RotationSlot.From(zone))].MemberId);
        if (formationPhase == FormationPhase.Serving)
        {
            Assert.Equal(RotationRules.GetServingPlayer(state.Lineup, zone), alignment.Slots[0].MemberId);
        }

        if (RolesByLineupIndex.TryGetValue(state.System, out var roles))
        {
            Assert.All(alignment.Slots, slot => Assert.Equal(roles[state.Lineup.IndexOf(slot.MemberId)], slot.Role));
        }
        else
        {
            Assert.Equal(RotationKey.Zero, alignment.FormationKey);
            Assert.Equal(
                RotationSlot.All.Select(slot => $"P{slot.Value}"),
                alignment.Slots.Select(slot => slot.Role.Code));
            Assert.Equal(alignment.Slots[RotationSlot.All.IndexOf(RotationSlot.Three)].MemberId, alignment.ActingSetter);
        }
    }

    [Theory]
    [MemberData(nameof(Zones))]
    public void ActingSetter_FollowsTheSystem(int zone)
    {
        var isBackRow = BackRowZones.Contains(zone);

        Assert.Equal(RotationRulesTests.Lineup[0], SetterOf(FormationSystem.FiveOne, zone));
        Assert.Equal(RotationRulesTests.Lineup[isBackRow ? 0 : SecondSetterIndex], SetterOf(FormationSystem.SixTwo, zone));
        Assert.Equal(RotationRulesTests.Lineup[isBackRow ? SecondSetterIndex : 0], SetterOf(FormationSystem.FourTwo, zone));
    }

    public static TheoryData<int> Zones => new(RotationRules.SetterZoneSequence);

    public static TheoryData<string> Systems => new(FormationSystem.All.Select(system => system.Code));

    /// <summary>Six zones walk the rotation order of the catalog from the start, and swap only on the second pass.</summary>
    [Theory]
    [MemberData(nameof(Systems))]
    public void ZoneTable_PlaysTheRotationOrderOfTheCatalog(string code)
    {
        var system = FormationSystem.All.Single(candidate => candidate.Code == code);
        var rotationOrder = AlignmentGolden.Catalog.Systems[system].RotationOrder;
        var zones = RotationRules.SetterZoneSequence.Select(zone => AlignmentTables.ZoneFormations[system][zone]).ToList();
        var passes = RotationRules.SetterZoneSequence.Length / rotationOrder.Length;
        var expectedKeys = Enumerable.Repeat(rotationOrder, passes).SelectMany(order => order);
        var swapsOnSecondPass = system != FormationSystem.Livre && system != FormationSystem.FiveOne;
        var expectedSwaps = Enumerable.Range(0, passes)
            .SelectMany(pass => Enumerable.Repeat(swapsOnSecondPass && pass == 1, rotationOrder.Length));

        Assert.Equal(expectedKeys, zones.Select(zone => zone.FormationKey));
        Assert.Equal(expectedSwaps, zones.Select(zone => zone.SwapPairs));
        Assert.Equal(RotationRules.SetterZoneSequence.Order(), AlignmentTables.ZoneFormations[system].Keys.Order());
    }

    private static string SetterOf(FormationSystem system, int zone) =>
        ServeAlignmentRules.GetServeAlignment(
            AlignmentGolden.Catalog,
            new TeamState([], null, RotationRulesTests.Lineup, zone, system),
            FormationPhase.Receiving).ActingSetter;

    private static (TeamState State, FormationPhase Phase) StateOf(string system, int zone, string phase) =>
        (new TeamState([], null, RotationRulesTests.Lineup, zone, FormationSystem.All.Single(candidate => candidate.Code == system)),
            FormationPhase.All.Single(candidate => candidate.Code == phase));
}
