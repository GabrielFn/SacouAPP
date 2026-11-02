using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.FormationCatalogs;
using Xunit;

namespace Sacou.Modules.Matches.Tests.Formations;

public sealed class FormationCatalogTests
{
    private static readonly FormationCatalog Catalog = EmbeddedFormationCatalog.Load();

    public static TheoryData<string, int> RotationsOutsideTheSystem => new()
    {
        { "6x2", 2 },
        { "6x2", 3 },
        { "6x2", 4 },
        { "4x2", 1 },
        { "4x2", 5 },
        { "4x2", 6 },
        { "livre", 1 },
        { "5x1", 0 },
    };

    [Theory]
    [MemberData(nameof(RotationsOutsideTheSystem))]
    public void GetFormation_WithARotationOutsideTheSystem_IsNull(string systemCode, int rotation)
    {
        var system = FormationSystem.All.Single(candidate => candidate.Code == systemCode);

        Assert.All(FormationPhase.All, phase => Assert.Null(Catalog.GetFormation(system, RotationKey.From(rotation), phase)));
    }

    [Fact]
    public void Serving_TakesTheBasePositionsAndTheSubstitutions()
    {
        var formation = Catalog.GetFormation(FormationSystem.FiveOne, RotationKey.Two, FormationPhase.Serving);

        Assert.NotNull(formation);
        Assert.Equal(Catalog.BasePositions[RotationSlot.One], formation.Slots[RotationSlot.One].Point);
        Assert.Equal(
            Catalog.Systems[FormationSystem.FiveOne].Rotations[RotationKey.Two].ServeSubstitution![RotationSlot.One],
            formation.Slots[RotationSlot.One].Role);
    }

    [Fact]
    public void RotationSlots_AreTheOnesOfTheOtherLanguage()
    {
        Assert.Equal([1, 2, 3, 4, 5, 6], RotationSlot.All.Select(slot => slot.Value));
    }

    [Fact]
    public void RotationKeys_AreTheOnesOfTheOtherLanguage()
    {
        Assert.Equal([0, 1, 2, 3, 4, 5, 6], RotationKey.All.Select(key => key.Value));
    }

    [Fact]
    public void PlayerRoles_AreTheOnesOfTheOtherLanguage()
    {
        Assert.Equal(
            ["S", "S1", "S2", "OPP", "OH1", "OH2", "MB1", "MB2", "L", "P1", "P2", "P3", "P4", "P5", "P6"],
            PlayerRole.All.Select(role => role.Code));
    }

    [Fact]
    public void FormationSystems_AreTheOnesOfTheOtherLanguage()
    {
        Assert.Equal(["5x1", "6x2", "4x2", "livre"], FormationSystem.All.Select(system => system.Code));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(7)]
    public void RotationSlot_OutOfRange_Throws(int value)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => RotationSlot.From(value));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(7)]
    public void RotationKey_OutOfRange_Throws(int value)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => RotationKey.From(value));
    }
}
