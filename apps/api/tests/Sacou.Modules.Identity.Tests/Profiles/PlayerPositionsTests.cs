using Sacou.Modules.Identity.Domain.Profiles;
using Xunit;
using P = Sacou.Modules.Identity.Domain.Profiles.PlayingPosition;
using Primary = Sacou.Modules.Identity.Domain.Profiles.PrimaryPosition;

namespace Sacou.Modules.Identity.Tests.Profiles;

/// <summary>P1 of E3.17 (ADR 0051, D6): the main position and the others.</summary>
public sealed class PlayerPositionsTests
{
    [Fact]
    public void NoMainPosition_WithNoOthers_IsAccepted()
    {
        var positions = PlayerPositions.Create(primary: null, []).Value;

        Assert.Null(positions.Primary);
        Assert.Empty(positions.Others);
    }

    [Fact]
    public void AnyPosition_WithNoOthers_IsAccepted()
    {
        Assert.Equal(Primary.Any, PlayerPositions.Create(Primary.Any, []).Value.Primary);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(Primary.Any)]
    public void NoOrAnyMainPosition_WithOthers_IsRefused(Primary? primary)
    {
        Assert.Equal(ProfileErrors.ProfileInvalid, PlayerPositions.Create(primary, [P.Libero]).Error);
    }

    [Fact]
    public void OtherEqualToTheMainOne_IsRefused()
    {
        Assert.Equal(ProfileErrors.ProfileInvalid, PlayerPositions.Create(Primary.Setter, [P.Setter]).Error);
    }

    [Fact]
    public void RepeatedOther_IsRefused()
    {
        Assert.Equal(ProfileErrors.ProfileInvalid, PlayerPositions.Create(Primary.Setter, [P.Libero, P.Libero]).Error);
    }

    [Fact]
    public void FiveOthers_AreRefused()
    {
        Assert.Equal(ProfileErrors.ProfileInvalid, PlayerPositions.Create(Primary.Setter, Enum.GetValues<P>()).Error);
    }

    [Fact]
    public void FourOthers_WithoutTheMainOne_AreAccepted()
    {
        Assert.Equal(PlayerPositions.MaxOtherPositions, PlayerPositions.Create(Primary.Libero, [P.Setter, P.OutsideHitter, P.Opposite, P.MiddleBlocker]).Value.Others.Count);
    }

    [Fact]
    public void NullOthers_AreRefused()
    {
        Assert.Equal(ProfileErrors.ProfileInvalid, PlayerPositions.Create(primary: null, others: null).Error);
    }

    [Fact]
    public void Others_AreKeptInTheCanonicalOrder()
    {
        var positions = PlayerPositions.Create(Primary.Opposite, [P.Libero, P.Setter, P.MiddleBlocker]).Value;

        Assert.Equal([P.Setter, P.MiddleBlocker, P.Libero], positions.Others);
    }

    [Fact]
    public void EveryMainPosition_HasAConcreteTwinButAny()
    {
        Assert.Null(PlayerPositions.Concrete(Primary.Any));
        Assert.Null(PlayerPositions.Concrete(null));
        Assert.Equal(
            Enum.GetValues<P>(),
            Enum.GetValues<Primary>().Where(primary => primary != Primary.Any).Select(primary => PlayerPositions.Concrete(primary)!.Value));
    }
}
