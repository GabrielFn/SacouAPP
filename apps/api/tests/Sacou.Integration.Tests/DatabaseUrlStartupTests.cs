using System.Net;
using Npgsql;
using Sacou.Api.Configuration;
using Xunit;

namespace Sacou.Integration.Tests;

/// <summary>
/// The Cloud Run start (ADR 0068, D5 and D7): no connection string, only <c>SACOU_DATABASE_URL</c>, and the
/// migrations on start. The URL points at an empty database of the throwaway server, so the start really migrates.
/// </summary>
public sealed class DatabaseUrlStartupTests(IntegrationDatabase database)
{
    private const string EmptyDatabase = "sacou_from_url";
    private const string HealthPath = "/health";

    /// <summary>The test server has no TLS; an insecure sslmode is accepted only in Development (D5).</summary>
    private const string DevelopmentEnvironment = "Development";

    [Fact]
    public async Task Start_WithOnlyTheDatabaseUrl_MigratesAndAnswersHealth()
    {
        await CreateEmptyDatabaseAsync();
        await using var api = new ApiWithDatabase(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["environment"] = DevelopmentEnvironment,
            ["ConnectionStrings:Sacou"] = string.Empty,
            [DatabaseUrl.EnvironmentVariable] = UrlOf(EmptyDatabase),
            ["Database:MigrateOnStartup"] = "true",
        });
        using var client = api.CreateClient();

        using var response = await client.GetAsync(new Uri(HealthPath, UriKind.Relative), TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await CountTablesAsync(EmptyDatabase) > 0, "The start did not migrate the database named by the URL.");
    }

    private string UrlOf(string databaseName)
    {
        var server = new NpgsqlConnectionStringBuilder(database.ConnectionString);
        return $"postgresql://{Uri.EscapeDataString(server.Username ?? string.Empty)}:{Uri.EscapeDataString(server.Password ?? string.Empty)}"
            + $"@{server.Host}:{server.Port}/{databaseName}?sslmode=disable";
    }

    private async Task CreateEmptyDatabaseAsync()
    {
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var create = new NpgsqlCommand($"CREATE DATABASE {EmptyDatabase}", connection);
        await create.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private async Task<long> CountTablesAsync(string databaseName)
    {
        var builder = new NpgsqlConnectionStringBuilder(database.ConnectionString) { Database = databaseName };
        await using var connection = new NpgsqlConnection(builder.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var count = new NpgsqlCommand(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')", connection);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken) ?? 0L);
    }
}
