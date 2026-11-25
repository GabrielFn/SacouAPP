using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Operations;

/// <summary>
/// A database of its own for each test class of the operator's counts (E7.2): the counts are of whole tables, so the
/// rows the other test classes write to the shared database would change them. Migrated by the API's own entry points,
/// seeded by hand-written SQL so every instant, status, source and channel is exact.
/// </summary>
public abstract class MetricsDatabase(IntegrationDatabase database) : IAsyncLifetime
{
    public const string Operator = "uid-operador-metricas";

    private readonly string name = "ops_" + Guid.NewGuid().ToString("N");

    private ApiWithDatabase? api;

    internal ApiWithDatabase Api => api ?? throw new InvalidOperationException("The database has not started.");

    internal string ConnectionString { get; private set; } = string.Empty;

    public async ValueTask InitializeAsync()
    {
        await using (var connection = new NpgsqlConnection(database.ConnectionString))
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            await using var create = new NpgsqlCommand($"CREATE DATABASE {name}", connection);
            await create.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        ConnectionString = new NpgsqlConnectionStringBuilder(database.ConnectionString) { Database = name }.ConnectionString;
        api = new ApiWithDatabase(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["ConnectionStrings:Sacou"] = ConnectionString,
            ["Operations:OperatorSubjects"] = Operator,
        });
        await api.MigrateAsync();
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        if (api is not null)
        {
            await api.DisposeAsync();
        }
    }

    /// <summary>One statement of the seed, with its parameters by name.</summary>
    internal async Task ExecuteAsync(string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (parameter, value) in parameters)
        {
            command.Parameters.AddWithValue(parameter, value);
        }

        await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>A contract of a module, from a scope of the API, as the dashboard's reader gets it.</summary>
    internal async Task<TResult> AskAsync<TContract, TResult>(Func<TContract, Task<TResult>> ask)
        where TContract : notnull
    {
        await using var scope = Api.Services.CreateAsyncScope();
        return await ask(scope.ServiceProvider.GetRequiredService<TContract>());
    }
}
