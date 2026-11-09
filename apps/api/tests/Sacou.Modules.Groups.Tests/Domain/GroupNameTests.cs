using Sacou.Modules.Groups.Domain.Groups;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>D1: NFC, 1 to 60 text elements, at most 240 code points, nothing invisible, something visible.</summary>
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
    private const int CombiningAcute = 0x0301;
    private const int CombiningCircumflex = 0x0302;
    private const int VariationSelector16 = 0xFE0F;
    private const char HighSurrogate = (char)0xD800;
    private const char LowSurrogate = (char)0xDC00;

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
        "Racha" + Text(0x0378),
        "Racha" + Text(0xE000),
        "Racha" + Text(0xF0000),
        "Racha" + HighSurrogate,
        LowSurrogate + "Racha",
        "Ra" + Text(0x115F) + "cha",
        "Ra" + Text(0x1160) + "cha",
        "Ra" + Text(0x3164) + "cha",
        "Ra" + Text(0xFFA0) + "cha",
        "Ra" + Text(0x2800) + "cha",
        Text(0x3164),
        Text(0x2800, 0x2800),
    };

    /// <summary>Nothing a reader would take for a name: punctuation, marks or spaces only.</summary>
    public static readonly TheoryData<string> NoVisibleContent = new()
    {
        "...",
        "- _ -",
        Text(CombiningAcute),
        "(!)",
    };

    public static readonly TheoryData<string> VisibleContent = new()
    {
        "2026",
        "!!! Racha",
        "#5",
        Text(0x26BD),
        Text('1', VariationSelector16, 0x20E3),
        Text(0x1F3F3, VariationSelector16, ZeroWidthJoiner, 0x1F308),
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

    [Fact]
    public void DecomposedText_IsStoredAsNfc()
    {
        var name = GroupName.Create("Vo" + Text(CombiningCircumflex) + "lei").Value;

        Assert.Equal("Vôlei", name.Value);
        Assert.Equal(GroupName.Create("Vôlei").Value, name);
    }

    [Theory]
    [MemberData(nameof(NoVisibleContent))]
    public void NoLetterNumberOrSymbol_IsRefused(string name)
    {
        Assert.Equal(GroupErrors.NameInvalid, GroupName.Create(name).Error);
    }

    [Theory]
    [MemberData(nameof(VisibleContent))]
    public void DigitsSymbolsAndEmojis_AreAccepted(string name)
    {
        Assert.True(GroupName.Create(name).IsSuccess);
    }

    /// <summary>"x" never composes with the acute accent, so NFC keeps every mark.</summary>
    [Fact]
    public void MarksPerCharacter_StopAtFour()
    {
        var four = "Racha x" + string.Concat(Enumerable.Repeat(Text(CombiningAcute), GroupName.MaxMarksPerCharacter));

        Assert.True(GroupName.Create(four).IsSuccess);
        Assert.True(GroupName.Create(four + Text(CombiningAcute)).IsFailure);
    }

    /// <summary>A stored name is trusted: one the rule now refuses still comes back as it was.</summary>
    [Fact]
    public void FromStored_KeepsANameTheRuleRefuses()
    {
        var stored = "Ra" + Text(0x3164) + "cha";

        Assert.True(GroupName.Create(stored).IsFailure);
        Assert.Equal(stored, GroupName.FromStored(stored).Value);
        Assert.Throws<ArgumentNullException>(() => GroupName.FromStored(null!));
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
