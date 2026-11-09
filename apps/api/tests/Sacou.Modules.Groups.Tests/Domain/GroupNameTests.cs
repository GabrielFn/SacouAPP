using Sacou.Modules.Groups.Domain.Groups;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>D1: 1 to 60 text elements, at most 240 code points, nothing invisible.</summary>
public sealed class GroupNameTests
{
    // Built from code points: invisible characters must never sit literally in the source.
    private const int ZeroWidthSpace = 0x200B;
    private const int ZeroWidthJoiner = 0x200D;
    private const int RightToLeftOverride = 0x202E;
    private const int LineSeparator = 0x2028;
    private const int ParagraphSeparator = 0x2029;
    private const int ByteOrderMark = 0xFEFF;
    private const int Person = 0x1F9D1;
    private const int Laptop = 0x1F4BB;

    private static readonly string Joiner = char.ConvertFromUtf32(ZeroWidthJoiner);
    private static readonly string Technologist = Text(Person, ZeroWidthJoiner, Laptop);
    private static readonly string Family = Text(0x1F468, ZeroWidthJoiner, 0x1F469, ZeroWidthJoiner, 0x1F467);

    public static readonly TheoryData<string> ComposedEmojis = new()
    {
        Technologist,
        Text(0x1F44D, 0x1F3FD),
        Text(0x1F1E7, 0x1F1F7),
    };

    public static readonly TheoryData<string> InvisibleText = new()
    {
        "Racha\nde quinta",
        "Racha" + Text(0),
        "Ra" + Text(ZeroWidthSpace) + "cha",
        "Racha " + Text(RightToLeftOverride) + "atniuq",
        "Ra" + Text(LineSeparator) + "cha",
        "Ra" + Text(ParagraphSeparator) + "cha",
        "Ra" + Joiner + "cha",
        Joiner + Text(Laptop),
        Text(Person) + Joiner,
        Text(ByteOrderMark) + "Racha",
    };

    [Theory]
    [InlineData("V")]
    [InlineData("Racha de quinta")]
    [InlineData("Vôlei do João")]
    public void PlainNames_AreAccepted(string name)
    {
        Assert.Equal(name, GroupName.Create(name).Value.Value);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(GroupName.MaxLength)]
    public void LengthsAtTheBorders_AreAccepted(int length)
    {
        Assert.True(GroupName.Create(new string('a', length)).IsSuccess);
    }

    [Theory]
    [MemberData(nameof(ComposedEmojis))]
    public void SixtyComposedEmojis_CountAsSixty(string emoji)
    {
        var name = string.Concat(Enumerable.Repeat(emoji, GroupName.MaxLength));

        Assert.True(GroupName.Create(name).IsSuccess);
        Assert.True(GroupName.Create(name + emoji).IsFailure);
    }

    /// <summary>60 families are 60 text elements but 300 code points: over the database limit.</summary>
    [Fact]
    public void EmojisOverTheCodePointLimit_AreRefused()
    {
        Assert.True(GroupName.Create(string.Concat(Enumerable.Repeat(Family, 48))).IsSuccess);
        Assert.True(GroupName.Create(string.Concat(Enumerable.Repeat(Family, 49))).IsFailure);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    public void EmptyOrBlank_AreRefused(string? name)
    {
        Assert.Equal(GroupErrors.NameInvalid, GroupName.Create(name).Error);
    }

    [Theory]
    [MemberData(nameof(InvisibleText))]
    public void ControlFormatOrLooseJoiner_AreRefused(string name)
    {
        Assert.Equal(GroupErrors.NameInvalid, GroupName.Create(name).Error);
    }

    private static string Text(params int[] codePoints) => string.Concat(codePoints.Select(char.ConvertFromUtf32));

    [Fact]
    public void SixtyOneCharacters_AreRefused()
    {
        Assert.True(GroupName.Create(new string('a', GroupName.MaxLength + 1)).IsFailure);
    }

    [Fact]
    public void SpacesAtTheEnds_AreTrimmed()
    {
        Assert.Equal("Racha", GroupName.Create("  Racha \t").Value.Value);
        Assert.True(GroupName.Create(" " + new string('a', GroupName.MaxLength) + " ").IsSuccess);
    }

    [Fact]
    public void ToString_NeverShowsTheName()
    {
        Assert.DoesNotContain("Racha", GroupName.Create("Racha").Value.ToString(), StringComparison.Ordinal);
    }
}
