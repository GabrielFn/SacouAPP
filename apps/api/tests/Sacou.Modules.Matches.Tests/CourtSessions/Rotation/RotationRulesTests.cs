using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.FormationCatalogs;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Rotation;

/// <summary>Port of the pure parts of <c>rotation-rules.test.ts</c>, plus the roster partition.</summary>
public sealed class RotationRulesTests
{
    private const string Outsider = "a0000000-0000-4000-8000-000000000099";
    private const string LiberoMember = "a0000000-0000-4000-8000-000000000007";
    private const string BenchMember = "a0000000-0000-4000-8000-000000000008";

    internal static readonly ImmutableArray<string> Lineup =
    [
        "a0000000-0000-4000-8000-000000000001",
        "a0000000-0000-4000-8000-000000000002",
        "a0000000-0000-4000-8000-000000000003",
        "a0000000-0000-4000-8000-000000000004",
        "a0000000-0000-4000-8000-000000000005",
        "a0000000-0000-4000-8000-000000000006",
    ];

    public static TheoryData<int> Zones => new(RotationRules.SetterZoneSequence);

    [Fact]
    public void Sequence_IsTheRotationOrderOfThe5x1InTheCatalog()
    {
        var catalog = EmbeddedFormationCatalog.Load();

        Assert.Equal(
            RotationRules.SetterZoneSequence,
            catalog.Systems[FormationSystem.FiveOne].RotationOrder.Select(key => key.Value));
    }

    [Fact]
    public void PreviousSetterZone_IsNotTheTableOfTheForwardRotation()
    {
        Assert.Equal([2, 1, 6, 5, 4, 3], RotationRules.SetterZoneSequence.Select(RotationRules.PreviousSetterZone));
    }

    [Theory]
    [MemberData(nameof(Zones))]
    public void PreviousSetterZone_UndoesOneRotation_AndNeverLeavesTheZones(int zone)
    {
        Assert.Equal(zone, RotationRules.PreviousSetterZone(RotationRules.NextSetterZone(zone)));
        Assert.Equal(zone, RotationRules.NextSetterZone(RotationRules.PreviousSetterZone(zone)));
        Assert.Contains(RotationRules.PreviousSetterZone(zone), RotationRules.SetterZoneSequence);
    }

    [Fact]
    public void NextSetterZone_WalksTheSequence_AndStartsOver()
    {
        Assert.Equal([6, 5, 4, 3, 2, 1], RotationRules.SetterZoneSequence.Select(RotationRules.NextSetterZone));
    }

    [Fact]
    public void LineupBySlot_InZone2_HasTheSecondMemberServing()
    {
        var bySlot = RotationRules.GetLineupBySlot(Lineup, 2);

        Assert.Equal(Lineup[5], bySlot[0]);
        Assert.Equal(Lineup[0], bySlot[1]);
        Assert.Equal(Lineup[5], RotationRules.GetServingPlayer(Lineup, 2));
    }

    [Fact]
    public void UnknownZone_IsAProgrammingError()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => RotationRules.GetLineupBySlot(Lineup, 7));
    }

    [Fact]
    public void SideOut_AndNextFirstServer()
    {
        Assert.True(RotationRules.IsSideOut(TeamSide.A, TeamSide.B));
        Assert.False(RotationRules.IsSideOut(TeamSide.B, TeamSide.B));
        Assert.Equal(TeamSide.B, RotationRules.GetNextSetFirstServer(TeamSide.A));
        Assert.Equal(TeamSide.A, RotationRules.GetNextSetFirstServer(TeamSide.B));
    }

    [Fact]
    public void RosterPartition_HoldsEachMemberOnce_AndNobodyElse()
    {
        var roster = new TeamRoster([.. Lineup, BenchMember, LiberoMember]);
        var libero = new TeamLibero(LiberoMember, [2]);

        Assert.True(RotationRules.IsRosterPartition(Lineup, [BenchMember], libero, roster));
        Assert.False(RotationRules.IsRosterPartition(Lineup, [BenchMember], null, roster));
        Assert.False(RotationRules.IsRosterPartition(Lineup, [BenchMember, BenchMember], null, roster));
        Assert.False(RotationRules.IsRosterPartition(Lineup, [Outsider], libero, roster));
        Assert.False(RotationRules.IsRosterPartition(Lineup, [BenchMember, LiberoMember], libero, roster));
    }

    [Fact]
    public void RosterPartition_ComparesByCodeUnit()
    {
        var roster = new TeamRoster([.. Lineup, BenchMember]);

        Assert.False(RotationRules.IsRosterPartition(Lineup, [BenchMember.ToUpperInvariant()], null, roster));
    }
}
