using System.Security.Cryptography;
using System.Text;
using DotNet.Testcontainers.Builders;
using Docker.DotNet.Models;
using DotNet.Testcontainers.Containers;
using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Backup;

/// <summary>
/// The image of the backup job (deploy/backup, ADR 0082) with scripts/backup/backup.sh copied in, sharing the network of the
/// integration Postgres so it reaches it on localhost, as the job reaches the Neon. Two fresh databases per test: the source
/// (migrated by the API) and the empty target of the restore.
/// </summary>
internal sealed class BackupTools : IAsyncDisposable
{
    /// <summary>The job's image, by digest; a guard in test:tooling keeps it equal to scripts/gcp/setup-backups.sh.</summary>
    internal const string BackupImage = "postgres:18.6-alpine@sha256:9ba53c7d41ea093baf5c1ba635ba5434c4f979880527d49bb7d9237d3193085b";

    internal const string BackupDirectory = "/backups";

    private const string ScriptPath = "/scripts/backup.sh";
    private const string ScriptInRepository = "scripts/backup/backup.sh";
    private const string SolutionFile = "Sacou.slnx";
    private const int DatabaseNameBytes = 6;
    private const int ServerPort = 5432;

    private readonly IContainer container;
    private readonly string serverConnectionString;

    private BackupTools(IContainer container, string serverConnectionString, string source, string target)
    {
        this.container = container;
        this.serverConnectionString = serverConnectionString;
        SourceConnectionString = WithDatabase(serverConnectionString, source);
        TargetConnectionString = WithDatabase(serverConnectionString, target);
        SourceUrl = UrlOf(SourceConnectionString, "localhost");
        TargetUrl = UrlOf(TargetConnectionString, "localhost");
        Password = new NpgsqlConnectionStringBuilder(serverConnectionString).Password ?? string.Empty;
    }

    internal string SourceConnectionString { get; }

    internal string TargetConnectionString { get; }

    /// <summary>postgresql:// URL of the source, as the job's secret holds it.</summary>
    internal string SourceUrl { get; }

    internal string TargetUrl { get; }

    internal string Password { get; }

    /// <summary>The same source through 127.0.0.2: still this machine, but not an address the script trusts without TLS.</summary>
    internal string SourceUrlOutsideTheMachine(string query) => $"{UrlOf(SourceConnectionString, "127.0.0.2")}?{query}";

    public static async Task<BackupTools> StartAsync(IntegrationDatabase database)
    {
        var source = NewDatabaseName("backup_source");
        var target = NewDatabaseName("backup_target");
        await using (var connection = new NpgsqlConnection(database.ConnectionString))
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            foreach (var name in new[] { source, target })
            {
                await using var create = new NpgsqlCommand($"CREATE DATABASE {name}", connection);
                _ = await create.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }

        var container = new ContainerBuilder(BackupImage)
            .WithEntrypoint("tail", "-f", "/dev/null")
            .WithCreateParameterModifier(parameters => parameters.HostConfig = new HostConfig { NetworkMode = $"container:{database.ContainerId}" })
            .Build();
        await container.StartAsync(TestContext.Current.CancellationToken);
        var script = await File.ReadAllBytesAsync(Path.Combine(RepositoryRoot(), ScriptInRepository), TestContext.Current.CancellationToken);
        await container.CopyAsync(script, ScriptPath, ct: TestContext.Current.CancellationToken);
        var tools = new BackupTools(container, database.ConnectionString, source, target);
        _ = await tools.RunAsync(["mkdir", "-p", BackupDirectory]);
        return tools;
    }

    /// <summary>Runs <c>backup.sh dump</c> with the given environment.</summary>
    internal Task<ExecResult> DumpAsync(string url, string environment = "production") =>
        RunAsync(["env", $"SACOU_BACKUP_DATABASE_URL={url}", $"SACOU_BACKUP_ENVIRONMENT={environment}", $"SACOU_BACKUP_DIR={BackupDirectory}", "sh", ScriptPath, "dump"]);

    internal Task<ExecResult> RestoreCheckAsync(string dump, string manifest) =>
        RunAsync(["env", $"SACOU_RESTORE_DATABASE_URL={TargetUrl}", "sh", ScriptPath, "restore-check", dump, manifest]);

    /// <summary>The files the dump left in the backup directory, by name.</summary>
    internal async Task<IReadOnlyList<string>> BackupFilesAsync()
    {
        var listing = await RunAsync(["ls", "-A", BackupDirectory]);
        return [.. listing.Stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Order(StringComparer.Ordinal)];
    }

    internal async Task<string> ReadAsync(string path) =>
        Encoding.UTF8.GetString(await container.ReadFileAsync(path, TestContext.Current.CancellationToken));

    internal async Task<ExecResult> RunAsync(IList<string> command) =>
        await container.ExecAsync(command, TestContext.Current.CancellationToken);

    internal static async Task<long> CountAsync(string connectionString, string sql)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        return Convert.ToInt64(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), System.Globalization.CultureInfo.InvariantCulture);
    }

    internal static async Task ExecuteAsync(string connectionString, string sql)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        _ = await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await container.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        await using var connection = new NpgsqlConnection(serverConnectionString);
        await connection.OpenAsync();
        foreach (var connectionString in new[] { SourceConnectionString, TargetConnectionString })
        {
            var name = new NpgsqlConnectionStringBuilder(connectionString).Database;
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS {name} WITH (FORCE)", connection);
            _ = await drop.ExecuteNonQueryAsync();
        }
    }

    private static string NewDatabaseName(string prefix) =>
        $"{prefix}_{Convert.ToHexString(RandomNumberGenerator.GetBytes(DatabaseNameBytes)).ToLowerInvariant()}";

    private static string WithDatabase(string connectionString, string database) =>
        new NpgsqlConnectionStringBuilder(connectionString) { Database = database }.ConnectionString;

    /// <summary>Inside the shared network the server listens on its own port, not the one published to the host.</summary>
    private static string UrlOf(string connectionString, string host)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        return $"postgresql://{Uri.EscapeDataString(builder.Username ?? string.Empty)}:{Uri.EscapeDataString(builder.Password ?? string.Empty)}@{host}:{ServerPort}/{builder.Database}";
    }

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, SolutionFile)))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException($"{SolutionFile} not found above the test folder.");
    }
}
