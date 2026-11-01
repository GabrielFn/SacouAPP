using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests;

public sealed class PostgresRoundTripTests(IntegrationDatabase database)
{
    private const int ExpectedMajorVersion = 18;
    private const string StoredName = "sacou";

    [Fact]
    public async Task Server_IsTheMajorVersionProductionUses()
    {
        await using var connection = await OpenAsync();

        var major = connection.PostgreSqlVersion.Major;

        Assert.Equal(ExpectedMajorVersion, major);
    }

    [Fact]
    public async Task TemporaryTable_StoresAndReturnsAParameter()
    {
        await using var connection = await OpenAsync();
        await using (var create = new NpgsqlCommand("CREATE TEMP TABLE sample (name text NOT NULL)", connection))
        {
            await create.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        await using (var insert = new NpgsqlCommand("INSERT INTO sample (name) VALUES (@name)", connection))
        {
            insert.Parameters.AddWithValue("name", StoredName);
            await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        await using var select = new NpgsqlCommand("SELECT name FROM sample", connection);
        var stored = await select.ExecuteScalarAsync(TestContext.Current.CancellationToken);

        Assert.Equal(StoredName, stored);
    }

    private async Task<NpgsqlConnection> OpenAsync()
    {
        var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }
}
