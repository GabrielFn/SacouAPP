using Microsoft.Extensions.Configuration;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Infrastructure;
using Xunit;

namespace Sacou.Modules.Groups.Tests.Infrastructure;

/// <summary>Case 5 of the plan: the pool fits two connections per running two-connection request plus the headroom (ADR 0062, D4).</summary>
public sealed class DualConnectionPoolValidatorTests
{
    private const string Password = "pool-test-secret";
    private const string Base = "Host=db.example;Database=sacou;Username=sacou;Password=" + Password;

    private static readonly RateLimitingOptions Initial = new() { DualConnectionConcurrency = 8, DualConnectionQueue = 16, DualConnectionHeadroom = 4 };

    [Fact]
    public void DefaultPool_FitsTheInitialValues()
    {
        Assert.True(Validate(Base, Initial).Succeeded);
    }

    [Fact]
    public void PoolOfExactlyTheNeed_Passes()
    {
        Assert.True(Validate(Base + ";Maximum Pool Size=20", Initial).Succeeded);
    }

    [Fact]
    public void SmallPool_FailsWithoutEchoingTheConnectionString()
    {
        var result = Validate(Base + ";Maximum Pool Size=10", Initial);

        Assert.True(result.Failed);
        Assert.Contains("20", result.FailureMessage, StringComparison.Ordinal);
        Assert.DoesNotContain(Password, result.FailureMessage, StringComparison.Ordinal);
        Assert.DoesNotContain("db.example", result.FailureMessage, StringComparison.Ordinal);
    }

    [Fact]
    public void UnreadableConnectionString_FailsWithoutEchoingIt()
    {
        var result = Validate("Host=db.example;Password=" + Password + ";Maximum Pool Size=not-a-number", Initial);

        Assert.True(result.Failed);
        Assert.DoesNotContain(Password, result.FailureMessage, StringComparison.Ordinal);
    }

    /// <summary>No connection string yet (a test host, a tool): Npgsql's default pool of 100.</summary>
    [Fact]
    public void MissingConnectionString_UsesTheDefaultPool()
    {
        Assert.Equal(100, DualConnectionPoolValidator.MaxPoolSize(null));
        Assert.True(Validate(null, Initial).Succeeded);
    }

    private static Microsoft.Extensions.Options.ValidateOptionsResult Validate(string? connectionString, RateLimitingOptions options)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [$"ConnectionStrings:{GroupsDatabase.ConnectionStringName}"] = connectionString })
            .Build();
        return new DualConnectionPoolValidator(configuration).Validate(null, options);
    }
}
