using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Sacou.Api.Configuration;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups;
using Xunit;

namespace Sacou.Api.Tests.Configuration;

/// <summary>How the start picks the database (ADR 0068, D5 and D6) and how it stops (D11).</summary>
public sealed class DatabaseConnectionSetupTests
{
    private const string Password = "zzzzzzzzzzzz";
    private const string NeonUrl = $"postgresql://sacou_owner:{Password}@ep-test.us-east-1.aws.neon.tech/sacou?sslmode=require";

    [Fact]
    public void FilledConnectionString_IgnoresTheUrl()
    {
        var configuration = Configuration(new()
        {
            [DatabaseConnectionSetup.ConnectionStringKey] = SacouApiFactory.ClosedDatabase,
            [DatabaseUrl.EnvironmentVariable] = "mysql://broken",
        });

        Assert.True(DatabaseConnectionSetup.Apply(configuration, isDevelopment: false).IsSuccess);
        Assert.Equal(SacouApiFactory.ClosedDatabase, configuration[DatabaseConnectionSetup.ConnectionStringKey]);
    }

    [Fact]
    public void Url_FillsTheConnectionString()
    {
        var configuration = Configuration(new() { [DatabaseUrl.EnvironmentVariable] = NeonUrl });

        Assert.True(DatabaseConnectionSetup.Apply(configuration, isDevelopment: false).IsSuccess);
        Assert.Contains("SSL Mode=VerifyFull", configuration[DatabaseConnectionSetup.ConnectionStringKey], StringComparison.Ordinal);
    }

    [Fact]
    public void NoDatabaseAndMigrationOn_StopsWithAClearMessage()
    {
        var configuration = Configuration(new() { [DatabaseConnectionSetup.MigrateOnStartupKey] = "true" });

        var result = DatabaseConnectionSetup.Apply(configuration, isDevelopment: false);

        Assert.Equal(DatabaseConnectionSetup.Missing, result.Error);
        Assert.Contains(DatabaseUrl.EnvironmentVariable, DatabaseConnectionSetup.FailureMessage(result.Error), StringComparison.Ordinal);
    }

    [Fact]
    public void NoDatabaseAndNoMigration_StartsAsBefore()
    {
        Assert.True(DatabaseConnectionSetup.Apply(Configuration([]), isDevelopment: false).IsSuccess);
    }

    [Fact]
    public void BrokenUrl_StopsWithoutTheUrl()
    {
        var configuration = Configuration(new() { [DatabaseUrl.EnvironmentVariable] = NeonUrl.Replace("sslmode=require", "sslmode=disable", StringComparison.Ordinal) });

        var message = DatabaseConnectionSetup.FailureMessage(DatabaseConnectionSetup.Apply(configuration, isDevelopment: false).Error);

        Assert.Contains("database_url.insecure_ssl_mode", message, StringComparison.Ordinal);
        Assert.DoesNotContain(Password, message, StringComparison.Ordinal);
        Assert.DoesNotContain("neon.tech", message, StringComparison.Ordinal);
        Assert.Null(configuration[DatabaseConnectionSetup.ConnectionStringKey]);
    }

    /// <summary>The pool the URL gives fits the two-connection routes of ADR 0062 (2 × 8 + 4 = 20 ≤ 30).</summary>
    [Fact]
    public void ConvertedPool_PassesTheTwoConnectionCheck()
    {
        var configuration = Configuration(new() { [DatabaseUrl.EnvironmentVariable] = NeonUrl }, withAppSettings: true);
        Assert.True(DatabaseConnectionSetup.Apply(configuration, isDevelopment: false).IsSuccess);
        using var services = new ServiceCollection().AddLogging().AddGroupsModule(configuration).AddSacouRateLimiting(configuration).BuildServiceProvider();

        var options = services.GetRequiredService<IOptions<RateLimitingOptions>>().Value;

        Assert.True(options.DualConnectionPoolNeed <= DatabaseUrl.MaximumPoolSize);
    }

    [Fact]
    public async Task Host_StopsBeforeCloudRunKillsIt()
    {
        await using var factory = new SacouApiFactory();

        var options = factory.Services.GetRequiredService<IOptions<HostOptions>>().Value;

        Assert.Equal(TimeSpan.FromSeconds(8), options.ShutdownTimeout);
    }

    private static IConfigurationRoot Configuration(Dictionary<string, string?> values, bool withAppSettings = false)
    {
        var builder = new ConfigurationBuilder();
        if (withAppSettings)
        {
            builder.AddJsonFile(Path.Combine(AppContext.BaseDirectory, "appsettings.json"));
        }

        return builder.AddInMemoryCollection(values).Build();
    }
}
