using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using Sacou.Api.Operations;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>
/// Door 1 of E6.3 in a real process: <c>dotnet Sacou.Api.dll reapply-deletions ...</c> exits on its own with the
/// command's code and one line, and never binds the server's port. The refusals before any database read are enough to
/// prove the branch without a Postgres; the success path runs in <c>ReapplyDeletionsTests</c> (integration).
/// </summary>
public sealed class OperationCommandProcessTests
{
    private const string ApiAssembly = "Sacou.Api.dll";
    private const string UnreachableDatabase = "postgres://sacou:sacou@127.0.0.1:1/sacou?sslmode=disable";

    /// <summary>Another database on the same unreachable server: the source must never be the restored database (criterion 11).</summary>
    private const string UnreachableSource = "postgres://sacou_backup:sacou@127.0.0.1:1/sacou_current?sslmode=disable";
    private static readonly TimeSpan ExitTimeout = TimeSpan.FromSeconds(60);

    [Theory]
    [InlineData("2020-01-01T00:00:00Z", ReapplyDeletionsCommand.DumpTooOld, @"^reapply-deletions: dump older than the mark retention \(\d+ days\)$")]
    [InlineData("2999-01-01T00:00:00Z", ReapplyDeletionsCommand.UsageError, @"^reapply-deletions: usage: .*--dump-created-at in the future$")]
    public async Task TheCommand_ExitsWithItsCode_AndNeverListens(string dumpCreatedAt, int expectedCode, string expectedLine)
    {
        // The port the server would take is held here: had the binary fallen through to the server, it would crash.
        using var held = new TcpListener(IPAddress.Loopback, 0);
        held.Start();
        var port = ((IPEndPoint)held.LocalEndpoint).Port;

        var (code, stdout, stderr) = await RunAsync(port, UnreachableSource, ReapplyDeletionsCommand.Name, "--dump-created-at", dumpCreatedAt);

        AssertOneLine(expectedCode, expectedLine, code, stdout, stderr);
    }

    /// <summary>Criterion 11: both URLs on the same host, port and database is a usage error, before any connection.</summary>
    [Fact]
    public async Task SourceEqualToTheRestoredDatabase_IsAUsageError_BeforeAnyConnection()
    {
        using var held = new TcpListener(IPAddress.Loopback, 0);
        held.Start();
        var port = ((IPEndPoint)held.LocalEndpoint).Port;
        var dumpCreatedAt = DateTimeOffset.UtcNow.AddHours(-1).ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", System.Globalization.CultureInfo.InvariantCulture);

        var (code, stdout, stderr) = await RunAsync(port, UnreachableDatabase.Replace("sacou:sacou", "sacou_backup:other", StringComparison.Ordinal), ReapplyDeletionsCommand.Name, "--dump-created-at", dumpCreatedAt);

        AssertOneLine(ReapplyDeletionsCommand.UsageError, @"^reapply-deletions: usage: .*points to the restored database$", code, stdout, stderr);
    }

    private static void AssertOneLine(int expectedCode, string expectedLine, int code, string stdout, string stderr)
    {
        Assert.True(expectedCode == code, $"exit {code}: {stderr}");
        var line = Assert.Single(stdout.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        Assert.Matches(expectedLine, line);
        Assert.DoesNotContain("listening", stdout + stderr, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("127.0.0.1", stdout + stderr, StringComparison.Ordinal);
    }

    private static async Task<(int Code, string Stdout, string Stderr)> RunAsync(int port, string source, params string[] arguments)
    {
        var start = new ProcessStartInfo(DotnetHost())
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            WorkingDirectory = AppContext.BaseDirectory,
        };
        start.ArgumentList.Add(Path.Combine(AppContext.BaseDirectory, ApiAssembly));
        foreach (var argument in arguments)
        {
            start.ArgumentList.Add(argument);
        }

        foreach (var key in start.Environment.Keys.Where(key => key.StartsWith("SACOU_", StringComparison.OrdinalIgnoreCase)).ToList())
        {
            start.Environment.Remove(key);
        }

        start.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
        start.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
        start.Environment["SACOU_DATABASE_URL"] = UnreachableDatabase;
        start.Environment[ReapplyDeletionsCommand.SourceVariable] = source;

        using var process = Process.Start(start) ?? throw new InvalidOperationException("dotnet did not start.");
        var stdout = process.StandardOutput.ReadToEndAsync(TestContext.Current.CancellationToken);
        var stderr = process.StandardError.ReadToEndAsync(TestContext.Current.CancellationToken);
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        timeout.CancelAfter(ExitTimeout);
        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            throw new TimeoutException("The command did not exit on its own: the server started.");
        }

        return (process.ExitCode, await stdout, await stderr);
    }

    /// <summary>The <c>dotnet</c> host of the runtime this test runs on: its root is three levels above the shared runtime.</summary>
    private static string DotnetHost()
    {
        var root = Path.GetFullPath(Path.Combine(RuntimeEnvironment.GetRuntimeDirectory(), "..", "..", ".."));
        return Path.Combine(root, OperatingSystem.IsWindows() ? "dotnet.exe" : "dotnet");
    }
}
