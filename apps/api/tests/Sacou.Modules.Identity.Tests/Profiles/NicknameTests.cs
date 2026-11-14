using Sacou.Modules.Identity.Domain.Profiles;
using Xunit;

namespace Sacou.Modules.Identity.Tests.Profiles;

/// <summary>P1 of E3.17 (ADR 0051, D11): the rule of the group name, with a 20-character and 80-code-point ceiling.</summary>
public sealed class NicknameTests
{
    // Built from code points: invisible characters must never sit literally in the source.
    private const int ZeroWidthSpace = 0x200B;
    private const int ZeroWidthJoiner = 0x200D;
    private const int RightToLeftOverride = 0x202E;
    private const int ByteOrderMark = 0xFEFF;
    private const int Woman = 0x1F469;
    private const int Laptop = 0x1F4BB;
    private const int CombiningAcute = 0x0301;
    private const int Smile = 0x1F600;

    private static readonly string Joiner = char.ConvertFromUtf32(ZeroWidthJoiner);

    /// <summary>One text element of seven code points: man, woman, girl, boy, joined.</summary>
    private static readonly string Family = Text(0x1F468, ZeroWidthJoiner, Woman, ZeroWidthJoiner, 0x1F467, ZeroWidthJoiner, 0x1F466);

    public static readonly TheoryData<string> InvisibleText = new()
    {
        "Jo\nao",
        "Jo\tao",
        "Joao" + Text(0),
        "Jo" + Text(ZeroWidthSpace) + "ao",
        Text(ByteOrderMark) + "Joao",
        "Joao " + Text(RightToLeftOverride) + "oaj",
        "Jo" + Text(0x115F) + "ao",
        "Jo" + Text(0x1160) + "ao",
        "Jo" + Text(0x3164) + "ao",
        "Jo" + Text(0xFFA0) + "ao",
        "Jo" + Text(0x2800) + "ao",
        "Jo" + Joiner + "ao",
        "Joao" + Text(0x0378),
        "Joao" + Text(0xE000),
        "...",
    };

    [Theory]
    [InlineData("João")]
    [InlineData("Caio")]
    [InlineData("Bia 2")]
    public void PlainNicknames_AreAccepted(string nickname)
    {
        Assert.Equal(nickname, Nickname.Create(nickname).Value.Value);
    }

    [Fact]
    public void DecomposedText_IsStoredAsNfc()
    {
        Assert.Equal("João", Nickname.Create("Jo" + "a" + Text(0x0303) + "o").Value.Value);
        Assert.Equal(Nickname.Create("João").Value, Nickname.Create("Joa" + Text(0x0303) + "o").Value);
    }

    [Fact]
    public void TwentyCharacters_AreAcceptedAndTwentyOneRefused()
    {
        Assert.True(Nickname.Create(new string('a', Nickname.MaxLength)).IsSuccess);
        Assert.Equal(ProfileErrors.NicknameInvalid, Nickname.Create(new string('a', Nickname.MaxLength + 1)).Error);

    [Fact]
    public void TheLimitIsTwentyOnTheWire_NotJustTheConstant()
    {
        Assert.Equal(20, Nickname.MaxLength);
        Assert.True(Nickname.Create(new string('a', 20)).IsSuccess);
        Assert.True(Nickname.Create(new string('a', 21)).IsFailure);
    }
    }

    [Fact]
    public void TwentySimpleEmojis_AreAccepted()
    {
        Assert.True(Nickname.Create(string.Concat(Enumerable.Repeat(Text(Smile), Nickname.MaxLength))).IsSuccess);
    }

    /// <summary>A family counts as one character but seven code points: 11 fit in 80, 12 do not.</summary>
    [Fact]
    public void FamiliesOverTheCodePointCeiling_AreRefused()
    {
        Assert.True(Nickname.Create(Family).IsSuccess);
        Assert.True(Nickname.Create(string.Concat(Enumerable.Repeat(Family, 11))).IsSuccess);
        Assert.True(Nickname.Create(string.Concat(Enumerable.Repeat(Family, 12))).IsFailure);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void EmptyOrBlank_AreRefused(string? nickname)
    {
        Assert.Equal(ProfileErrors.NicknameInvalid, Nickname.Create(nickname).Error);
    }

    [Fact]
    public void SpacesAtTheEnds_AreTrimmed()
    {
        Assert.Equal("Caio", Nickname.Create("  Caio \t").Value.Value);
    }

    [Theory]
    [MemberData(nameof(InvisibleText))]
    public void InvisibleOrEmpty_IsRefused(string nickname)
    {
        Assert.Equal(ProfileErrors.NicknameInvalid, Nickname.Create(nickname).Error);
    }

    [Fact]
    public void JoinerInsideAnEmoji_IsAccepted()
    {
        Assert.True(Nickname.Create("Bia " + Text(Woman, ZeroWidthJoiner, Laptop)).IsSuccess);
    }

    /// <summary>"x" never composes with the acute accent, so NFC keeps every mark.</summary>
    [Fact]
    public void MarksPerCharacter_StopAtFour()
    {
        var four = "x" + string.Concat(Enumerable.Repeat(Text(CombiningAcute), 4));

        Assert.True(Nickname.Create(four).IsSuccess);
        Assert.True(Nickname.Create(four + Text(CombiningAcute)).IsFailure);
    }

    [Fact]
    public void LoneSurrogate_IsRefused()
    {
        Assert.True(Nickname.Create("Joao" + (char)0xD800).IsFailure);
    }

    [Fact]
    public void FromStored_KeepsANicknameTheRuleRefuses()
    {
        var stored = "Jo" + Text(0x3164) + "ao";

        Assert.Equal(stored, Nickname.FromStored(stored).Value);
        Assert.Throws<ArgumentNullException>(() => Nickname.FromStored(null!));
    }

    [Fact]
    public void ToString_NeverShowsTheNickname()
    {
        Assert.DoesNotContain("Caio", Nickname.Create("Caio").Value.ToString(), StringComparison.Ordinal);
    }

    private static string Text(params int[] codePoints) => string.Concat(codePoints.Select(char.ConvertFromUtf32));
}
