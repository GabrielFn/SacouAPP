using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Guests;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Guests;

/// <summary>G1 of E3.5 (ADR 0053, D3): the guest's name runs the same table of inputs as the nickname.</summary>
public sealed class GuestNameTests
{
    [Theory]
    [MemberData(nameof(PersonNameCases.Accepted), MemberType = typeof(PersonNameCases))]
    public void SharedTable_AcceptedNames_AreAccepted(string name)
    {
        Assert.Equal(name, GuestName.Create(name).Value.Value);
    }

    [Theory]
    [MemberData(nameof(PersonNameCases.Refused), MemberType = typeof(PersonNameCases))]
    public void SharedTable_RefusedNames_AreTheGuestNameCode(string name)
    {
        Assert.Equal("groups.guest-name-invalid", GuestName.Create(name).Error.Code);
    }

    [Fact]
    public void NullOrLoneSurrogate_IsRefused()
    {
        Assert.Equal(GroupErrors.GuestNameInvalid, GuestName.Create(null).Error);
        Assert.Equal(GroupErrors.GuestNameInvalid, GuestName.Create(PersonNameCases.LoneSurrogate).Error);
    }

    [Fact]
    public void DecomposedText_IsStoredAsNfc_AndTrimmed()
    {
        Assert.Equal("João", GuestName.Create(PersonNameCases.DecomposedJoao).Value.Value);
        Assert.Equal("Léo", GuestName.Create("  Léo \t").Value.Value);
    }

    [Fact]
    public void ToString_NeverShowsTheName()
    {
        var name = GuestName.Create("Léo").Value;

        Assert.DoesNotContain("Léo", name.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("Léo", new GuestProfile(name, GuestPosition.Libero).ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void FromStored_KeepsANameTheRuleRefuses()
    {
        var stored = "Jo" + PersonNameCases.Text(0x3164) + "ao";

        Assert.Equal(stored, GuestName.FromStored(stored).Value);
    }
}
