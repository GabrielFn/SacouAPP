using System.Text;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Modules.Stats.RatingParameters;
using Xunit;

namespace Sacou.Modules.Stats.Tests.Ratings;

/// <summary>The embedded <c>rating-params.json</c> and its strict reading (ADR 0071, rule 24).</summary>
public sealed class RatingParamsTests
{
    private const string ValidJson = """
        {"ratingParamsVersion":1,"mu0":1500,"levelStep":200,"sigmaAdmin":100,"sigmaUnconfirmed":200,"beta":100,"tau":1,"kappa":0.0001,"limitSigma":false}
        """;

    /// <summary>Like the formation catalog version: a new file version fails until the port is checked against it.</summary>
    [Fact]
    public void EmbeddedFile_IsTheVersionThePortSupports()
    {
        Assert.Equal(RatingParams.SupportedVersion, EmbeddedRatingParams.Load().RatingParamsVersion);
    }

    [Fact]
    public void EmbeddedFile_HasThePilotValues()
    {
        Assert.Equal(new RatingParams(1, 1500, 200, 100, 200, 100, 1, 0.0001, LimitSigma: false), EmbeddedRatingParams.Load());
    }

    [Fact]
    public void ValidFile_IsRead()
    {
        Assert.Equal(EmbeddedRatingParams.Load(), Parse(ValidJson));
    }

    [Theory]
    [InlineData("\"mu0\":1500", "\"mu0\":0")]
    [InlineData("\"beta\":100", "\"beta\":-1")]
    [InlineData("\"tau\":1", "\"tau\":\"1\"")]
    [InlineData("\"ratingParamsVersion\":1", "\"ratingParamsVersion\":1.5")]
    [InlineData("\"limitSigma\":false", "\"limitSigma\":0")]
    [InlineData("\"kappa\":0.0001,", "")]
    [InlineData("\"mu0\":1500", "\"mu0\":1500,\"mu0\":1600")]
    [InlineData("\"mu0\":1500", "\"mu0\":1500,\"mu1\":1")]
    public void BrokenFile_Throws(string valid, string broken)
    {
        Assert.ThrowsAny<Exception>(() => Parse(ValidJson.Replace(valid, broken, StringComparison.Ordinal)));
    }

    [Fact]
    public void NotAnObject_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => Parse("[]"));
    }

    private static RatingParams Parse(string json)
    {
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
        return RatingParamsParser.Parse(stream);
    }
}
