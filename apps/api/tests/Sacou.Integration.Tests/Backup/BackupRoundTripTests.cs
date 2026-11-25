using System.Text.Json.Nodes;
using DotNet.Testcontainers.Containers;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Matches;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Backup;

/// <summary>
/// The daily backup (E5.3, ADR 0082): scripts/backup/backup.sh dumps a database migrated and filled by the real API and
/// restores it into an empty one with the same rows, in the job's image. Cases 1 to 6 of the plan's part 1.
/// </summary>
public sealed class BackupRoundTripTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string GroupName = "Racha Sigiloso do Backup";
    private const int Success = 0;

    private BackupTools tools = null!;
    private ApiWithDatabase api = null!;

    public async ValueTask InitializeAsync()
    {
        tools = await BackupTools.StartAsync(database);
        api = new ApiWithDatabase(database, new Dictionary<string, string?> { ["ConnectionStrings:Sacou"] = tools.SourceConnectionString });
        await api.MigrateAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await api.DisposeAsync();
        await tools.DisposeAsync();
    }

    [Fact]
    public async Task DumpThenRestore_GivesTheSameRowsAndMigrations_WithoutPersonalDataOrThePassword()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client, GroupName);
        var round = await CourtCalls.RoundAsync(world);
        var phone = CourtPhone.New();
        _ = await CourtCalls.AcceptedAsync(world, A.Scorekeeper, round, phone, [phone.MatchStarted(world.MemberIds[A.Admin], world.MemberIds[A.Player])]);

        var dumped = await tools.DumpAsync(tools.SourceUrl);
        var (dump, manifest) = await BackupPairAsync();
        var restored = await tools.RestoreCheckAsync(dump, manifest);

        AssertSucceeded(dumped);
        AssertSucceeded(restored);
        var document = JsonNode.Parse(await tools.ReadAsync(manifest))!.AsObject();
        var rows = document["rows"]!.AsObject();
        Assert.Equal("production", document["environment"]!.GetValue<string>());
        Assert.Equal(await BackupTools.CountAsync(tools.SourceConnectionString, "SELECT count(*) FROM identity.users"), rows["identity.users"]!.GetValue<long>());
        Assert.Equal(await BackupTools.CountAsync(tools.TargetConnectionString, "SELECT count(*) FROM groups.members"), rows["groups.members"]!.GetValue<long>());
        Assert.True(rows["groups.members"]!.GetValue<long>() > 0);
        Assert.NotEmpty(document["migrations"]!.AsObject());
        var forbidden = world.Subjects.Values.Append(GroupName).Append(tools.Password);
        var everything = string.Join('\n', await tools.ReadAsync(manifest), dumped.Stdout, dumped.Stderr, restored.Stdout, restored.Stderr);
        Assert.All(forbidden, text => Assert.DoesNotContain(text, everything, StringComparison.Ordinal));
    }

    [Fact]
    public async Task Dump_OutsideTheMachine_ForcesVerifiedTls_AndLeavesNothing()
    {
        var dumped = await tools.DumpAsync(tools.SourceUrlOutsideTheMachine("sslmode=disable"));

        Assert.NotEqual(Success, dumped.ExitCode);
        Assert.Contains("SSL", dumped.Stderr, StringComparison.Ordinal);
        Assert.DoesNotContain(tools.Password, dumped.Stdout + dumped.Stderr, StringComparison.Ordinal);
        Assert.Empty(await tools.BackupFilesAsync());
    }

    [Fact]
    public async Task Dump_WithAnUnknownEnvironment_FailsBeforeWriting()
    {
        var dumped = await tools.DumpAsync(tools.SourceUrl, environment: "staging");

        Assert.NotEqual(Success, dumped.ExitCode);
        Assert.Contains("SACOU_BACKUP_ENVIRONMENT", dumped.Stderr, StringComparison.Ordinal);
        Assert.Empty(await tools.BackupFilesAsync());
    }

    [Fact]
    public async Task Dump_ThatFailsHalfway_LeavesNoFileWithABackupName()
    {
        // A role that connects but reads nothing: the session opens, and pg_dump fails without USAGE on the module schemas.
        await BackupTools.ExecuteAsync(tools.SourceConnectionString, "DROP ROLE IF EXISTS backup_blind; CREATE ROLE backup_blind LOGIN");
        var blind = tools.SourceUrl.Replace("postgresql://postgres:", "postgresql://backup_blind:", StringComparison.Ordinal);

        var dumped = await tools.DumpAsync(blind);

        Assert.NotEqual(Success, dumped.ExitCode);
        Assert.Empty(await tools.BackupFilesAsync());
    }

    [Fact]
    public async Task RestoreCheck_RefusesADumpThatDoesNotMatchTheManifest_AndRestoresNothing()
    {
        AssertSucceeded(await tools.DumpAsync(tools.SourceUrl));
        var (dump, manifest) = await BackupPairAsync();
        AssertSucceeded(await tools.RunAsync(["sh", "-c", $"printf x >> {dump}"]));

        var restored = await tools.RestoreCheckAsync(dump, manifest);

        Assert.NotEqual(Success, restored.ExitCode);
        Assert.Contains("SHA-256", restored.Stderr, StringComparison.Ordinal);
        Assert.Equal(0, await TargetTablesAsync());
    }

    [Fact]
    public async Task RestoreCheck_RefusesATargetWithTables()
    {
        AssertSucceeded(await tools.DumpAsync(tools.SourceUrl));
        var (dump, manifest) = await BackupPairAsync();
        await BackupTools.ExecuteAsync(tools.TargetConnectionString, "CREATE TABLE precious (id int)");

        var restored = await tools.RestoreCheckAsync(dump, manifest);

        Assert.NotEqual(Success, restored.ExitCode);
        Assert.Contains("empty database", restored.Stderr, StringComparison.Ordinal);
        Assert.Equal(1, await TargetTablesAsync());
    }

    [Fact]
    public async Task RestoreCheck_FailsWhenARowCountDiffers()
    {
        AssertSucceeded(await tools.DumpAsync(tools.SourceUrl));
        var (dump, manifest) = await BackupPairAsync();
        AssertSucceeded(await tools.RunAsync(["sed", "-i", "s/^    \"identity.users\": [0-9]*/    \"identity.users\": 999/", manifest]));

        var restored = await tools.RestoreCheckAsync(dump, manifest);

        Assert.NotEqual(Success, restored.ExitCode);
        Assert.Contains("differs from the manifest", restored.Stderr, StringComparison.Ordinal);
    }

    private async Task<(string Dump, string Manifest)> BackupPairAsync()
    {
        var files = await tools.BackupFilesAsync();
        Assert.Equal(2, files.Count);
        var dump = Assert.Single(files, file => file.EndsWith(".dump", StringComparison.Ordinal));
        var manifest = Assert.Single(files, file => file.EndsWith(".manifest.json", StringComparison.Ordinal));
        Assert.Equal(dump[..^".dump".Length], manifest[..^".manifest.json".Length]);
        return ($"{BackupTools.BackupDirectory}/{dump}", $"{BackupTools.BackupDirectory}/{manifest}");
    }

    private Task<long> TargetTablesAsync() => BackupTools.CountAsync(
        tools.TargetConnectionString,
        "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')");

    private static void AssertSucceeded(ExecResult result) =>
        Assert.True(result.ExitCode == Success, $"exit {result.ExitCode}: {result.Stderr}");
}
