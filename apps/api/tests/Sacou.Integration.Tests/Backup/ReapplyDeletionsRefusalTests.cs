using System.Globalization;
using System.Security.Cryptography;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Sacou.Api.Operations;
using Sacou.Integration.Tests.Groups;
using Sacou.Modules.Identity.Contracts;
using Xunit;

namespace Sacou.Integration.Tests.Backup;

/// <summary>
/// S2 of E6.3: the command never lets the operator think it worked when it did not. A source whose role can write, a
/// source older than the restored database, an unreadable source and a target with no Identity schema are refused
/// before any write; a failure in the middle exits 5 and the next run finishes. Three databases of the shared server:
/// the current one (source), the restored one (target) and an empty one.
/// </summary>
public sealed class ReapplyDeletionsRefusalTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const int Succeeded = 0;
    private const int NameBytes = 4;
    private const int PasswordBytes = 18;
    private const string CountMarks = "SELECT count(*) FROM identity.deleted_accounts";

    private readonly string readerRole = "deletions_reader_" + Hex(NameBytes);
    private readonly string readerPassword = Hex(PasswordBytes);
    private readonly string sourceName = "reapply_source_" + Hex(NameBytes);
    private readonly string targetName = "reapply_target_" + Hex(NameBytes);
    private readonly string emptyName = "reapply_empty_" + Hex(NameBytes);

    private ApiWithDatabase target = null!;

    private string SourceConnectionString => WithDatabase(sourceName);

    private string TargetConnectionString => WithDatabase(targetName);

    public async ValueTask InitializeAsync()
    {
        foreach (var name in new[] { sourceName, targetName, emptyName })
        {
            await BackupTools.ExecuteAsync(database.ConnectionString, $"CREATE DATABASE {name}");
        }

        await BackupTools.ExecuteAsync(database.ConnectionString, $"CREATE ROLE {readerRole} LOGIN PASSWORD '{readerPassword}' IN ROLE pg_read_all_data");
        await using (var source = new ApiWithDatabase(database, new Dictionary<string, string?> { ["ConnectionStrings:Sacou"] = SourceConnectionString }))
        {
            await source.MigrateAsync();
        }

        target = new ApiWithDatabase(database, new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            // The test server has no TLS; an insecure sslmode is accepted only in Development (ADR 0068, D5).
            ["environment"] = "Development",
            ["ConnectionStrings:Sacou"] = TargetConnectionString,
        });
        await target.MigrateAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await target.DisposeAsync();
        NpgsqlConnection.ClearAllPools();
        foreach (var name in new[] { sourceName, targetName, emptyName })
        {
            await BackupTools.ExecuteAsync(database.ConnectionString, $"DROP DATABASE IF EXISTS {name} WITH (FORCE)");
        }

        await BackupTools.ExecuteAsync(database.ConnectionString, $"DROP ROLE IF EXISTS {readerRole}");
    }

    /// <summary>The API's own credential (a role that can write) as the source is refused with 2, nothing written on either side.</summary>
    [Fact]
    public async Task SourceWhoseRoleCanWrite_IsAUsageError_WritingNothing()
    {
        await MarkAsync(SourceConnectionString, "uid-writable-source");
        var server = new NpgsqlConnectionStringBuilder(database.ConnectionString);

        var (code, output) = await RunAsync(Url(server.Username!, server.Password!, sourceName));

        Assert.Equal(ReapplyDeletionsCommand.UsageError, code);
        Assert.Contains("can write", output, StringComparison.Ordinal);
        Assert.Equal(0, await BackupTools.CountAsync(TargetConnectionString, CountMarks));
        Assert.DoesNotContain(server.Password!, output, StringComparison.Ordinal);
    }

    /// <summary>The restored database has a recent mark the source lacks: the URLs were swapped, so 2 and nothing copied.</summary>
    [Fact]
    public async Task TargetWithAMarkTheSourceLacks_IsAUsageError_WritingNothing()
    {
        await MarkAsync(TargetConnectionString, "uid-only-in-the-target");
        await MarkAsync(SourceConnectionString, "uid-only-in-the-source");

        var (code, output) = await RunAsync(ReaderUrl(sourceName));

        Assert.Equal(ReapplyDeletionsCommand.UsageError, code);
        Assert.Contains("swapped", output, StringComparison.Ordinal);
        Assert.Equal(1, await BackupTools.CountAsync(TargetConnectionString, CountMarks));
    }

    /// <summary>Criterion 12: a wrong password and a database without the marks table are both 3, nothing written.</summary>
    [Fact]
    public async Task UnreadableSource_ExitsThree_WritingNothing()
    {
        await MarkAsync(SourceConnectionString, "uid-unreadable");
        var wrongPassword = Url(readerRole, "not-" + readerPassword, sourceName);

        foreach (var source in new[] { wrongPassword, ReaderUrl(emptyName) })
        {
            var (code, output) = await RunAsync(source);

            Assert.Equal(ReapplyDeletionsCommand.SourceUnreadable, code);
            Assert.Equal("reapply-deletions: source unreadable", output.Trim());
        }

        Assert.Equal(0, await BackupTools.CountAsync(TargetConnectionString, CountMarks));
    }

    /// <summary>Criterion 16: a target without the Identity schema is 2, and the command does not create it.</summary>
    [Fact]
    public async Task TargetWithoutTheIdentitySchema_IsAUsageError_CreatingNothing()
    {
        var (code, output) = await RunAsync(ReaderUrl(sourceName), targetConnectionString: WithDatabase(emptyName));

        Assert.Equal(ReapplyDeletionsCommand.UsageError, code);
        Assert.Contains("no identity schema", output, StringComparison.Ordinal);
        Assert.Equal(0, await BackupTools.CountAsync(WithDatabase(emptyName), "SELECT count(*) FROM pg_namespace WHERE nspname = 'identity'"));
    }

    /// <summary>
    /// Criterion 14, through the real databases and the API's own erasures: a database failure of an erasure at the 2nd
    /// account of 3 exits 5 with <c>1 of 3</c>; the run after it, without the failure, exits 0 and erases the 2 left.
    /// </summary>
    [Fact]
    public async Task FailureInTheMiddle_ExitsFive_AndTheNextRunFinishes()
    {
        using var client = target.CreateClient();
        var world = await GroupWorld.CreateAsync(target, client);
        for (var person = 0; person < 3; person++)
        {
            var (subject, _) = await world.RegisterPersonAsync();
            await MarkAsync(SourceConnectionString, subject);
        }

        var failing = new FailingErasure(failOnCall: 1);
        var (code, output) = await RunAsync(ReaderUrl(sourceName), services => services.AddSingleton<IAccountErasure>(failing));

        Assert.Equal(ReapplyDeletionsCommand.Failed, code);
        Assert.Equal("reapply-deletions: failed after 1 of 3 accounts; run again", output.Trim());

        var (again, secondOutput) = await RunAsync(ReaderUrl(sourceName));

        Assert.Equal(Succeeded, again);
        Assert.StartsWith("reapply-deletions: ok, 3 marks, 0 new marks, 2 accounts erased, ", secondOutput, StringComparison.Ordinal);
    }

    private async Task<(int Code, string Output)> RunAsync(
        string sourceUrl, Action<IServiceCollection>? services = null, string? targetConnectionString = null)
    {
        await using var api = target.WithWebHostBuilder(builder =>
        {
            builder.UseSetting(ReapplyDeletionsCommand.SourceVariable, sourceUrl);
            if (targetConnectionString is not null)
            {
                builder.UseSetting("ConnectionStrings:Sacou", targetConnectionString);
            }

            if (services is not null)
            {
                builder.ConfigureTestServices(services);
            }
        });
        var command = OperationCommands.TryMatch(
            ["reapply-deletions", "--dump-created-at", DateTimeOffset.UtcNow.AddHours(-1).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture)]);
        await using var output = new StringWriter(CultureInfo.InvariantCulture);
        var code = await command!.RunAsync(api.Services, output, TestContext.Current.CancellationToken);
        return (code, output.ToString());
    }

    private static async Task MarkAsync(string connectionString, string subject)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var insert = new NpgsqlCommand(
            "INSERT INTO identity.deleted_accounts (subject_hash, deleted_at) VALUES (sha256(convert_to(@subject, 'UTF8')), now())", connection);
        insert.Parameters.AddWithValue("subject", subject);
        _ = await insert.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    private string ReaderUrl(string databaseName) => Url(readerRole, readerPassword, databaseName);

    private string Url(string user, string password, string databaseName)
    {
        var server = new NpgsqlConnectionStringBuilder(database.ConnectionString);
        return $"postgresql://{Uri.EscapeDataString(user)}:{Uri.EscapeDataString(password)}@{server.Host}:{server.Port}/{databaseName}?sslmode=disable";
    }

    private string WithDatabase(string name) => new NpgsqlConnectionStringBuilder(database.ConnectionString) { Database = name }.ConnectionString;

    private static string Hex(int bytes) => Convert.ToHexString(RandomNumberGenerator.GetBytes(bytes)).ToLowerInvariant();

    /// <summary>An erasure that fails as a lost connection would, on its <c>failOnCall</c>-th call (0-based), after the API's own.</summary>
    private sealed class FailingErasure(int failOnCall) : IAccountErasure
    {
        private int calls;

        public Task<IReadOnlyList<Guid>> EraseAsync(Guid userId, ErasureMode mode, CancellationToken cancellationToken) =>
            Interlocked.Increment(ref calls) - 1 == failOnCall
                ? throw new NpgsqlException("connection lost")
                : Task.FromResult<IReadOnlyList<Guid>>([]);
    }
}
