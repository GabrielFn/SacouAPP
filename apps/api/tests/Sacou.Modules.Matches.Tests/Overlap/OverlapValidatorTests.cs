using Sacou.Modules.Matches.Domain.Formations;
using Sacou.Modules.Matches.Domain.Overlap;
using Sacou.Tests.Golden;
using Xunit;

namespace Sacou.Modules.Matches.Tests.Overlap;

/// <summary>What JSON cannot represent stays out of the golden file (ADR 0021), and has its equivalent here.</summary>
public sealed class OverlapValidatorTests
{
    private static readonly OverlapRuleMode Fivb = OverlapRuleMode.Fivb2025To28;
    private static readonly OverlapRuleMode Classic = OverlapRuleMode.Classic;
    private static readonly FormationPhase Receiving = FormationPhase.Receiving;
    private static readonly FormationPhase Serving = FormationPhase.Serving;

    public static TheoryData<int, bool, double> InfiniteCoordinates => new()
    {
        { 1, true, double.PositiveInfinity },
        { 1, false, double.NegativeInfinity },
        { 2, false, double.PositiveInfinity },
        { 2, true, double.NegativeInfinity },
    };

    [Theory]
    [InlineData(double.NaN)]
    [InlineData(double.PositiveInfinity)]
    [InlineData(double.NegativeInfinity)]
    public void ToleranceThatIsNotFinite_IsInvalid_EvenWithNoRelationInForce(double tolerance)
    {
        Assert.IsType<OverlapResult.InvalidTolerance>(Validate(Base(), Fivb, Receiving, tolerance));
        Assert.IsType<OverlapResult.InvalidTolerance>(Validate(Base(), Fivb, Serving, tolerance));
        Assert.IsType<OverlapResult.InvalidTolerance>(Validate(Base(), Classic, Serving, tolerance));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void NaNInADepthCoordinate_Violates(int slot)
    {
        var positions = Base(WithY(RotationSlot.From(slot), double.NaN));

        OverlapTestData.AssertViolated(["1-behind-2"], Validate(positions, Fivb, Receiving));
    }

    [Fact]
    public void NaNInALateralCoordinate_Violates()
    {
        var positions = Base(WithX(RotationSlot.Four, double.NaN));

        OverlapTestData.AssertViolated(["4-left-of-3"], Validate(positions, Fivb, Receiving));
    }

    [Fact]
    public void NaNInACoordinateOfTwoRelations_ViolatesBoth_InTheFixedOrder()
    {
        var positions = Base(WithX(RotationSlot.Three, double.NaN));

        OverlapTestData.AssertViolated(["4-left-of-3", "3-left-of-2"], Validate(positions, Fivb, Receiving));
    }

    [Fact]
    public void NaNOnTheServingPlayer_DoesNotCount_WhenServing()
    {
        var positions = Base(WithY(RotationSlot.One, double.NaN));

        OverlapTestData.AssertPassed([], Validate(positions, Fivb, Serving));
        OverlapTestData.AssertPassed(OverlapTestData.WithoutServingPlayer, Validate(positions, Classic, Serving));
    }

    [Theory]
    [MemberData(nameof(InfiniteCoordinates))]
    public void InfiniteCoordinate_IsNotChecked_AndComparesAsANumber(int slot, bool holds, double y)
    {
        var result = Validate(Base(WithY(RotationSlot.From(slot), y)), Fivb, Receiving);

        if (holds)
        {
            OverlapTestData.AssertPassed(OverlapTestData.AllRelations, result);
        }
        else
        {
            OverlapTestData.AssertViolated(["1-behind-2"], result);
        }
    }

    [Fact]
    public void BothCoordinatesInfinite_Holds()
    {
        var positions = Base(WithY(RotationSlot.One, double.PositiveInfinity), WithY(RotationSlot.Two, double.PositiveInfinity));

        OverlapTestData.AssertPassed(OverlapTestData.AllRelations, Validate(positions, Fivb, Receiving));
    }

    [Theory]
    [InlineData(-0.0)]
    [InlineData(double.Epsilon)]
    [InlineData(double.MaxValue)]
    public void ExtremeFiniteTolerance_IsValid(double tolerance)
    {
        OverlapTestData.AssertPassed(OverlapTestData.AllRelations, Validate(Base(), Fivb, Receiving, tolerance));
    }

    [Fact]
    public void NegativeZeroTolerance_IsZero_NotTheDefault()
    {
        var positions = Base(WithY(RotationSlot.One, 0.25 - (OverlapValidator.DefaultTolerance / 2)));

        OverlapTestData.AssertViolated(["1-behind-2"], Validate(positions, Fivb, Receiving, -0.0));
        OverlapTestData.AssertPassed(OverlapTestData.AllRelations, Validate(positions, Fivb, Receiving));
    }

    [Fact]
    public void Defaults_AreTheOnesOfTheOtherLanguage()
    {
        Assert.Equal("fivb-2025-28", OverlapRuleMode.DefaultMode.Code);
        GoldenFile.AssertExact(0.02, OverlapValidator.DefaultTolerance, "default tolerance");
    }

    [Fact]
    public void Relations_KeepTheFixedOrder()
    {
        Assert.Equal(OverlapTestData.AllRelations, OverlapRelation.All.Select(relation => relation.Id));
    }

    [Fact]
    public void Modes_HaveTheCodesOfTheOtherLanguage()
    {
        Assert.Equal(["fivb-2025-28", "classic"], OverlapRuleMode.All.Select(mode => mode.Code));
    }

    [Fact]
    public void CourtPositions_WithoutASlot_Throws()
    {
        var points = OverlapTestData.BasePoints.Remove(RotationSlot.Four);

        var failure = Assert.Throws<ArgumentException>(() => new CourtPositions(points));

        Assert.Contains("Slot 4", failure.Message, StringComparison.Ordinal);
    }

    private static OverlapResult Validate(CourtPositions positions, OverlapRuleMode mode, FormationPhase phase, double? tolerance = null) =>
        OverlapValidator.Validate(positions, mode, phase, tolerance);

    private static CourtPositions Base(params (RotationSlot Slot, CourtPoint Point)[] changes) =>
        new(changes.Aggregate(
            OverlapTestData.BasePoints,
            (points, change) => points.SetItem(change.Slot, change.Point)));

    private static (RotationSlot Slot, CourtPoint Point) WithX(RotationSlot slot, double x) =>
        (slot, OverlapTestData.BasePoints[slot] with { X = x });

    private static (RotationSlot Slot, CourtPoint Point) WithY(RotationSlot slot, double y) =>
        (slot, OverlapTestData.BasePoints[slot] with { Y = y });
}
