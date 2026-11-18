using Npgsql;
using Sacou.Api.Configuration;
using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Api.Tests.Configuration;

/// <summary>The Neon URL into a connection string (ADR 0068, D5 and D6). The password never shows in an error.</summary>
public sealed class DatabaseUrlTests
{
    // Low entropy on purpose: the secret scan must not flag a test value.
    private const string Password = "zzzzzzzzzzzz";
    private const string Host = "ep-quiet-sky-a1b2c3d4.us-east-1.aws.neon.tech";
    private const string NeonUrl = $"postgresql://sacou_owner:{Password}@{Host}/sacou?sslmode=require&channel_binding=require";

    [Fact]
    public void NeonUrl_BecomesAVerifiedConnectionWithTheDeployPool()
    {
        var builder = Convert(NeonUrl, isDevelopment: false);

        Assert.Equal(Host, builder.Host);
        Assert.Equal(DatabaseUrl.DefaultPort, builder.Port);
        Assert.Equal("sacou", builder.Database);
        Assert.Equal("sacou_owner", builder.Username);
        Assert.Equal(Password, builder.Password);
        Assert.Equal(SslMode.VerifyFull, builder.SslMode);
        Assert.Equal(ChannelBinding.Require, builder.ChannelBinding);
        Assert.Equal(30, builder.MaxPoolSize);
        Assert.Equal(60, builder.ConnectionIdleLifetime);
        Assert.Equal(10, builder.ConnectionPruningInterval);
        Assert.False(builder.IncludeErrorDetail);
    }

    [Fact]
    public void PostgresScheme_IsAccepted()
    {
        Assert.Equal(Host, Convert($"postgres://u:p@{Host}/sacou", isDevelopment: false).Host);
    }

    [Fact]
    public void ExplicitPort_IsKept()
    {
        Assert.Equal(6543, Convert($"postgresql://u:p@{Host}:6543/sacou", isDevelopment: false).Port);
    }

    [Fact]
    public void EscapedCredentials_AreDecoded()
    {
        var builder = Convert($"postgresql://us%40er:p%2Fa%3Ass%40@{Host}/sacou", isDevelopment: false);

        Assert.Equal("us@er", builder.Username);
        Assert.Equal("p/a:ss@", builder.Password);
    }

    [Theory]
    [InlineData("require")]
    [InlineData("verify-ca")]
    [InlineData("verify-full")]
    public void SecureSslModes_AlwaysBecomeVerifyFull(string sslMode)
    {
        Assert.Equal(SslMode.VerifyFull, Convert($"postgresql://u:{Password}@{Host}/sacou?sslmode={sslMode}", isDevelopment: false).SslMode);
    }

    [Theory]
    [InlineData("disable")]
    [InlineData("allow")]
    [InlineData("prefer")]
    public void InsecureSslModes_AreRefusedOutsideDevelopment(string sslMode)
    {
        AssertRefused($"postgresql://u:{Password}@{Host}/sacou?sslmode={sslMode}", DatabaseUrlErrors.InsecureSslMode);
    }

    [Fact]
    public void DisabledSsl_IsKeptOnADeveloperMachine()
    {
        Assert.Equal(SslMode.Disable, Convert($"postgresql://u:{Password}@localhost/sacou?sslmode=disable", isDevelopment: true).SslMode);
    }

    [Theory]
    [InlineData("Include%20Error%20Detail=true")]
    [InlineData("include_error_detail=true")]
    [InlineData("options=-c%20log_statement%3Dall")]
    [InlineData("sslrootcert=/tmp/ca.pem")]
    public void UnknownParameters_AreRefused(string parameter)
    {
        AssertRefused($"postgresql://u:{Password}@{Host}/sacou?sslmode=require&{parameter}", DatabaseUrlErrors.UnknownParameter);
        AssertRefused($"postgresql://u:{Password}@{Host}/sacou?{parameter}", DatabaseUrlErrors.UnknownParameter, isDevelopment: true);
    }

    [Theory]
    [InlineData($"postgresql://u:{Password}@{Host}/sacou?sslmode=maybe", "database_url.ssl_mode")]
    [InlineData($"postgresql://u:{Password}@{Host}/sacou?channel_binding=always", "database_url.channel_binding")]
    [InlineData($"mysql://u:{Password}@{Host}/sacou", "database_url.scheme")]
    [InlineData($"https://u:{Password}@{Host}/sacou", "database_url.scheme")]
    [InlineData($"postgresql://u:{Password}@{Host}", "database_url.database")]
    [InlineData($"postgresql://u:{Password}@{Host}/", "database_url.database")]
    [InlineData($"postgresql://u:{Password}@{Host}/sacou/other", "database_url.database")]
    [InlineData($"postgresql://:{Password}@{Host}/sacou", "database_url.username")]
    [InlineData($"postgresql://{Host}/sacou", "database_url.username")]
    [InlineData($"postgresql:u:{Password}", "database_url.host")]
    [InlineData($"u:{Password}@{Host}/sacou", "database_url.malformed")]
    [InlineData($"not a url {Password}", "database_url.malformed")]
    [InlineData("", "database_url.empty")]
    [InlineData("   ", "database_url.empty")]
    public void BrokenUrls_FailWithACodeThatHidesTheUrl(string url, string code)
    {
        var result = DatabaseUrl.ToConnectionString(url, isDevelopment: false);

        Assert.True(result.IsFailure);
        Assert.Equal(code, result.Error.Code);
        AssertHidesTheUrl(result.Error);
    }

    [Fact]
    public void NullUrl_IsEmpty()
    {
        Assert.Equal(DatabaseUrlErrors.Empty, DatabaseUrl.ToConnectionString(null, isDevelopment: false).Error);
    }

    private static NpgsqlConnectionStringBuilder Convert(string url, bool isDevelopment)
    {
        var result = DatabaseUrl.ToConnectionString(url, isDevelopment);
        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Code : string.Empty);
        return new NpgsqlConnectionStringBuilder(result.Value);
    }

    private static void AssertRefused(string url, Error expected, bool isDevelopment = false)
    {
        var result = DatabaseUrl.ToConnectionString(url, isDevelopment);

        Assert.True(result.IsFailure);
        Assert.Equal(expected, result.Error);
        AssertHidesTheUrl(result.Error);
    }

    private static void AssertHidesTheUrl(Error error)
    {
        Assert.DoesNotContain(Password, error.Code, StringComparison.Ordinal);
        Assert.DoesNotContain(Host, error.Code, StringComparison.Ordinal);
        Assert.DoesNotContain(Password, DatabaseConnectionSetup.FailureMessage(error), StringComparison.Ordinal);
        Assert.DoesNotContain(Host, DatabaseConnectionSetup.FailureMessage(error), StringComparison.Ordinal);
    }
}
