using Xunit;

namespace Sacou.Integration.Tests.Backup;

/// <summary>
/// The password of the URL reaches the tools only through PGPASSWORD, percent-decoded, never as an argument or a log line
/// (E5.3, ADR 0082). The tools are replaced by recorders, so no server has to check the password.
/// </summary>
public sealed class BackupPasswordTests(IntegrationDatabase database) : IAsyncLifetime
{
    private const string SpecialPassword = "p@ss:w/rd%41?#x y";
    private const string EncodedPassword = "p%40ss%3Aw%2Frd%2541%3F%23x%20y";
    private const string RecorderDirectory = "/tmp/recorders";
    private const string Record = "/tmp/recorded";

    private BackupTools tools = null!;

    public async ValueTask InitializeAsync()
    {
        tools = await BackupTools.StartAsync(database);
        const string recorder = """
            cat >/tmp/recorders/psql <<'SCRIPT'
            #!/bin/sh
            printf '%s\n' "$PGPASSWORD" >/tmp/recorded
            printf '%s\n' "$@" >>/tmp/recorded
            echo "fatal: $PGPASSWORD" >&2
            exit 1
            SCRIPT
            chmod +x /tmp/recorders/psql
            """;
        _ = await tools.RunAsync(["sh", "-c", $"mkdir -p {RecorderDirectory}; {recorder}"]);
    }

    public async ValueTask DisposeAsync() => await tools.DisposeAsync();

    [Fact]
    public async Task Dump_PassesTheDecodedPasswordOnlyThroughTheEnvironment_AndNeverPrintsIt()
    {
        var url = $"postgresql://sacou:{EncodedPassword}@localhost:5432/anything";

        var dumped = await tools.RunAsync(["env", $"PATH={RecorderDirectory}:/usr/local/bin:/usr/bin:/bin", $"SACOU_BACKUP_DATABASE_URL={url}", "SACOU_BACKUP_ENVIRONMENT=test", $"SACOU_BACKUP_DIR={BackupTools.BackupDirectory}", "sh", "/scripts/backup.sh", "dump"]);

        var recorded = (await tools.ReadAsync(Record)).Split('\n');
        Assert.NotEqual(0, dumped.ExitCode);
        Assert.Equal(SpecialPassword, recorded[0]);
        var arguments = string.Join('\n', recorded[1..]);
        Assert.DoesNotContain(SpecialPassword, arguments, StringComparison.Ordinal);
        Assert.DoesNotContain(EncodedPassword, arguments, StringComparison.Ordinal);
        var output = dumped.Stdout + dumped.Stderr;
        Assert.DoesNotContain(SpecialPassword, output, StringComparison.Ordinal);
        Assert.DoesNotContain(EncodedPassword, output, StringComparison.Ordinal);
        Assert.Empty(await tools.BackupFilesAsync());
    }

    [Fact]
    public async Task DumpAndRestoreCheck_NeverGiveThePasswordToAnyToolAsAnArgument()
    {
        const string wrapper = """
            for tool in psql pg_dump pg_restore; do
              { echo "#!/bin/sh"; echo "printf \"%s\\n\" \"\$@\" >>/tmp/argv"; echo "exec /usr/local/bin/$tool \"\$@\""; } >/tmp/recorders/$tool
              chmod +x /tmp/recorders/$tool
            done
            """;
        _ = await tools.RunAsync(["sh", "-c", $"mkdir -p {RecorderDirectory}; {wrapper}"]);
        await BackupTools.ExecuteAsync(tools.SourceConnectionString, "CREATE TABLE sample (id int); INSERT INTO sample VALUES (1)");
        var path = $"PATH={RecorderDirectory}:/usr/local/bin:/usr/bin:/bin";

        var dumped = await tools.RunAsync(["env", path, $"SACOU_BACKUP_DATABASE_URL={tools.SourceUrl}", "SACOU_BACKUP_ENVIRONMENT=test", $"SACOU_BACKUP_DIR={BackupTools.BackupDirectory}", "sh", "/scripts/backup.sh", "dump"]);
        Assert.True(dumped.ExitCode == 0, dumped.Stdout + dumped.Stderr);
        var files = await tools.BackupFilesAsync();
        var dump = $"{BackupTools.BackupDirectory}/{files.First(name => name.EndsWith(".dump", StringComparison.Ordinal))}";
        var manifest = $"{BackupTools.BackupDirectory}/{files.First(name => name.EndsWith(".json", StringComparison.Ordinal))}";
        var restored = await tools.RunAsync(["env", path, $"SACOU_RESTORE_DATABASE_URL={tools.TargetUrl}", "sh", "/scripts/backup.sh", "restore-check", dump, manifest]);

        var arguments = await tools.ReadAsync("/tmp/argv");
        Assert.Equal(0, dumped.ExitCode);
        Assert.Equal(0, restored.ExitCode);
        Assert.NotEmpty(tools.Password);
        Assert.DoesNotContain(tools.Password, arguments, StringComparison.Ordinal);
        Assert.Contains("--dbname=postgresql://", arguments, StringComparison.Ordinal);
    }
}
