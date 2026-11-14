using Sacou.Modules.Identity.Domain.Profiles;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Profiles;

/// <summary>
/// P1 of E3.17 (ADR 0051, D11): the rule of the group name, with a 20-character and 80-code-point ceiling. The inputs
/// are the table the guest name runs too (<see cref="PersonNameCases"/>, ADR 0053 D3).
/// </summary>
public sealed class NicknameTests
{
    [Theory]
    [MemberData(nameof(PersonNameCases.Accepted), MemberType = typeof(PersonNameCases))]
    public void SharedTable_AcceptedNames_AreAccepted(string nickname)
    {
        Assert.Equal(nickname, Nickname.Create(nickname).Value.Value);
    }

    [Theory]
    [MemberData(nameof(PersonNameCases.Refused), MemberType = typeof(PersonNameCases))]
    public void SharedTable_RefusedNames_AreRefused(string? nickname)
    {
        Assert.Equal(ProfileErrors.NicknameInvalid, Nickname.Create(nickname).Error);
    }

    [Fact]
    public void LoneSurrogate_IsRefused()
    {
        Assert.Equal(ProfileErrors.NicknameInvalid, Nickname.Create(PersonNameCases.LoneSurrogate).Error);
    }

    [Fact]
    public void TheLimitIsTwentyOnTheWire_NotJustTheConstant()
    {
        Assert.Equal(20, Nickname.MaxLength);
        Assert.Equal(80, Nickname.MaxCodePoints);
    }

    [Fact]
    public void DecomposedText_IsStoredAsNfc()
    {
        Assert.Equal("João", Nickname.Create(PersonNameCases.DecomposedJoao).Value.Value);
        Assert.Equal(Nickname.Create("João").Value, Nickname.Create(PersonNameCases.DecomposedJoao).Value);
    }

    [Fact]
    public void SpacesAtTheEnds_AreTrimmed()
    {
        Assert.Equal("Caio", Nickname.Create("  Caio \t").Value.Value);
    }

    [Fact]
    public void FromStored_KeepsANicknameTheRuleRefuses()
    {
        var stored = "Jo" + PersonNameCases.Text(0x3164) + "ao";

        Assert.Equal(stored, Nickname.FromStored(stored).Value);
        Assert.Throws<ArgumentNullException>(() => Nickname.FromStored(null!));
    }

    [Fact]
    public void ToString_NeverShowsTheNickname()
    {
        Assert.DoesNotContain("Caio", Nickname.Create("Caio").Value.ToString(), StringComparison.Ordinal);
    }
}
