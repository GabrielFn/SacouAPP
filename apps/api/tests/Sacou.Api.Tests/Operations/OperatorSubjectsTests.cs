using Microsoft.Extensions.Options;
using Sacou.Api.Operations;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>Criterion 5 and question 213 of E7.2: a list of 0, 1 or many UIDs; any item off the format stops the start.</summary>
public sealed class OperatorSubjectsTests
{
    [Theory]
    [InlineData(null, 0)]
    [InlineData("", 0)]
    [InlineData("   ", 0)]
    [InlineData("abc", 1)]
    [InlineData("abc,def", 2)]
    [InlineData("abc, def", 2)]
    [InlineData(" abc , def ", 2)]
    [InlineData("abc,abc", 1)]
    public void AWellFormedList_IsAccepted(string? value, int count)
    {
        var parsed = OperatorSubjects.Parse(value);

        Assert.True(parsed.IsSuccess);
        Assert.Equal(count, parsed.Value.Count);
    }

    [Theory]
    [InlineData("abc,,def")]
    [InlineData("abc,")]
    [InlineData(",abc")]
    [InlineData("ab c")]
    [InlineData("abç")]
    [InlineData("abc\tdef")]
    public void AnItemOffTheFormat_RefusesTheList(string value)
    {
        Assert.True(OperatorSubjects.Parse(value).IsFailure);
    }

    [Fact]
    public void AnItemOf129Characters_RefusesTheList_And128Passes()
    {
        Assert.True(OperatorSubjects.Parse(new string('a', 128)).IsSuccess);
        Assert.True(OperatorSubjects.Parse("abc," + new string('a', 129)).IsFailure);
    }

    [Fact]
    public void TheComparison_IsOrdinalAndExact()
    {
        var operators = OperatorSubjects.Parse("abc").Value;

        Assert.True(operators.Contains("abc"));
        Assert.False(operators.Contains("ABC"));
        Assert.False(operators.Contains("abd"));
        Assert.False(operators.Contains("ab"));
        Assert.False(operators.Contains("abc "));
        Assert.False(operators.Contains(null));
        Assert.DoesNotContain("abc", operators.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task AMalformedList_StopsTheStart_NamingTheKeyAndNeverTheValue()
    {
        const string Hostile = "uid-secreto-1,,uid-secreto-2";
        await using var host = new OpsHost(Hostile);

        var failure = Assert.Throws<OptionsValidationException>(() => host.CreateClient());

        Assert.Contains("Operations:OperatorSubjects", failure.Message, StringComparison.Ordinal);
        Assert.DoesNotContain("uid-secreto", failure.Message, StringComparison.Ordinal);
    }
}
