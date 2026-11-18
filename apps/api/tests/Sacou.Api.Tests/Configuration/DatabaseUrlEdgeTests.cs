using Npgsql;
using Sacou.Api.Configuration;
using Xunit;

namespace Sacou.Api.Tests.Configuration;

/// <summary>Edges the tester added to the URL conversion: repeated and re-cased parameters, scheme case.</summary>
public sealed class DatabaseUrlEdgeTests
{
    private const string Prefix = "postgresql://u:zzzzzzzzzzzz@ep-quiet-sky.neon.tech/sacou";

    [Theory]
    [InlineData("sslmode=require&sslmode=disable")]
    [InlineData("sslmode=disable&sslmode=require")]
    public void RepeatedSslMode_CannotSmuggleAnInsecureModeInProduction(string query)
    {
        var result = DatabaseUrl.ToConnectionString($"{Prefix}?{query}", isDevelopment: false);

        Assert.True(result.IsFailure);
        Assert.Equal(DatabaseUrlErrors.InsecureSslMode, result.Error);
    }

    [Theory]
    [InlineData("SSLMODE=disable")]
    [InlineData("Sslmode=disable")]
    public void ParameterNames_AreCaseSensitiveSoARecasedOneIsRefused(string query)
    {
        var result = DatabaseUrl.ToConnectionString($"{Prefix}?{query}", isDevelopment: false);

        Assert.True(result.IsFailure);
        Assert.Equal(DatabaseUrlErrors.UnknownParameter, result.Error);
    }

    [Fact]
    public void UppercaseScheme_IsAcceptedAndStillVerified()
    {
        var result = DatabaseUrl.ToConnectionString("POSTGRESQL://u:zzzzzzzzzzzz@ep-quiet-sky.neon.tech/sacou", isDevelopment: false);

        Assert.True(result.IsSuccess);
        Assert.Equal(SslMode.VerifyFull, new NpgsqlConnectionStringBuilder(result.Value).SslMode);
    }
}
