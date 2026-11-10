using Sacou.Modules.Groups.Domain.Templates;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Domain;

/// <summary>D4 of E3.3: 1 to 40 text elements, the rule of the group name.</summary>
public sealed class TemplateNameTests
{
    private const int ZeroWidthSpace = 0x200B;

    [Theory]
    [InlineData("A")]
    [InlineData("Racha de quinta")]
    [InlineData("  Treino  ")]
    public void Create_AcceptsAVisibleName(string name)
    {
        var created = TemplateName.Create(name);

        Assert.True(created.IsSuccess);
        Assert.Equal(name.Trim(), created.Value.Value);
    }

    [Fact]
    public void Create_AcceptsExactlyFortyCharacters_AndRefusesFortyOne()
    {
        Assert.True(TemplateName.Create(new string('a', TemplateName.MaxLength)).IsSuccess);
        Assert.True(TemplateName.Create(new string('a', TemplateName.MaxLength + 1)).IsFailure);
    }

    [Fact]
    public void Create_CountsAnEmojiAsOneCharacter()
    {
        var family = char.ConvertFromUtf32(0x1F468) + char.ConvertFromUtf32(0x200D) + char.ConvertFromUtf32(0x1F469);

        Assert.True(TemplateName.Create(string.Concat(Enumerable.Repeat(family, TemplateName.MaxLength))).IsSuccess);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("!!!")]
    public void Create_RefusesEmptyOrWithoutContent(string? name)
    {
        Assert.Equal("groups.template-name-invalid", TemplateName.Create(name).Error.Code);
    }

    [Fact]
    public void Create_RefusesInvisibleCharactersAndLoneSurrogates()
    {
        Assert.True(TemplateName.Create("Ra" + char.ConvertFromUtf32(ZeroWidthSpace) + "cha").IsFailure);
        Assert.True(TemplateName.Create("Racha" + (char)0xD800).IsFailure);
    }

    [Fact]
    public void Create_NormalizesToNfc()
    {
        Assert.Equal("é", TemplateName.Create("é").Value.Value);
    }

    [Fact]
    public void ToString_NeverPrintsTheName()
    {
        Assert.DoesNotContain("Racha", TemplateName.Create("Racha").Value.ToString(), StringComparison.Ordinal);
    }
}
