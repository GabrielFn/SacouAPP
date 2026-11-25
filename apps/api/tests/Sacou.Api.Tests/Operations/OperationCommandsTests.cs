using Sacou.Api.Operations;
using Sacou.Modules.Identity.Contracts;
using Xunit;

namespace Sacou.Api.Tests.Operations;

/// <summary>Door 1 of E6.3: only the command's name turns the binary into a command; the server starts otherwise (criterion 9).</summary>
public sealed class OperationCommandsTests
{
    [Theory]
    [InlineData]
    [InlineData("--urls", "http://0.0.0.0:8080")]
    [InlineData("Reapply-Deletions")]
    [InlineData("--reapply-deletions")]
    public void WithoutTheCommandName_TheServerStarts(params string[] args) => Assert.Null(OperationCommands.TryMatch(args));

    [Fact]
    public void TheCommandName_PicksTheReapply() =>
        Assert.IsType<ReapplyDeletionsCommand>(OperationCommands.TryMatch(["reapply-deletions", "--dump-created-at", "2026-11-25T04:00:00Z"]));

    [Theory]
    [InlineData("2026-11-25T04:00:00Z", "2026-11-25T04:00:00+00:00")]
    [InlineData("2026-11-25T01:00:00-03:00", "2026-11-25T04:00:00+00:00")]
    [InlineData("2026-11-25T04:00:00.5Z", "2026-11-25T04:00:00.5+00:00")]
    public void DumpCreatedAt_IsAnInstantWithItsOffset(string value, string expected) =>
        Assert.Equal(DateTimeOffset.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), ReapplyDeletionsCommand.ParseDumpCreatedAt(["--dump-created-at", value]));

    [Theory]
    [InlineData("--dump-created-at", "2026-11-25T04:00:00")]
    [InlineData("--dump-created-at", "25/11/2026 04:00")]
    [InlineData("--dump-created-at", "")]
    [InlineData("--dump-created-at")]
    [InlineData("2026-11-25T04:00:00Z")]
    [InlineData("--dump-created-at", "2026-11-25T04:00:00Z", "--extra")]
    [InlineData("--dump-created-at=2026-11-25T04:00:00Z")]
    public void DumpCreatedAt_MissingOrWithoutOffset_IsAUsageError(params string[] arguments) =>
        Assert.Null(ReapplyDeletionsCommand.ParseDumpCreatedAt(arguments));

    /// <summary>
    /// S2: each refusal of the handler has its exit code, and any other failure, even one never seen before, is a 5
    /// (run again), never a 0 nor the 4 of the dump guard.
    /// </summary>
    [Theory]
    [InlineData(DeletionMarkRetention.DumpOlderThanRetentionCode, ReapplyDeletionsCommand.DumpTooOld)]
    [InlineData(ReapplyDeletionsCodes.SourceUnreadable, ReapplyDeletionsCommand.SourceUnreadable)]
    [InlineData(ReapplyDeletionsCodes.SourceCanWrite, ReapplyDeletionsCommand.UsageError)]
    [InlineData(ReapplyDeletionsCodes.TargetAheadOfSource, ReapplyDeletionsCommand.UsageError)]
    [InlineData(ReapplyDeletionsCodes.Interrupted, ReapplyDeletionsCommand.Failed)]
    [InlineData("groups.some-failure-of-tomorrow", ReapplyDeletionsCommand.Failed)]
    public void EachRefusal_HasItsExitCode(string code, int expected) => Assert.Equal(expected, ReapplyDeletionsCommand.ExitCodeFor(code));

    /// <summary>Criterion 11: the same host (any case), port and database on both sides; the user and password do not matter.</summary>
    [Theory]
    [InlineData("Host=db.neon.tech;Port=5432;Database=sacou;Username=sacou_api", "Host=DB.neon.tech;Port=5432;Database=sacou;Username=sacou_backup", true)]
    [InlineData("Host=db.neon.tech;Database=sacou", "Host=db.neon.tech;Port=5432;Database=sacou", true)]
    [InlineData("Host=db.neon.tech;Port=5432;Database=sacou_restore", "Host=db.neon.tech;Port=5432;Database=sacou", false)]
    [InlineData("Host=db.neon.tech;Port=5433;Database=sacou", "Host=db.neon.tech;Port=5432;Database=sacou", false)]
    [InlineData("Host=other.neon.tech;Port=5432;Database=sacou", "Host=db.neon.tech;Port=5432;Database=sacou", false)]
    [InlineData("Host=db.neon.tech;Port=5432;Database=Sacou", "Host=db.neon.tech;Port=5432;Database=sacou", false)]
    public void SameDatabase_IsHostPortAndDatabase(string target, string source, bool same) =>
        Assert.Equal(same, ReapplyDeletionsCommand.SameDatabase(target, source));

    /// <summary>Criterion 6: only numbers, in the culture-free form.</summary>
    [Fact]
    public void Summary_IsOneLineOfNumbers() => Assert.Equal(
        "ok, 7 marks, 2 new marks, 1 accounts erased, 0 groups left without admin, 1.3 s",
        ReapplyDeletionsCommand.Describe(new ReapplyDeletionsSummary(7, 2, 1, 1, 0, TimeSpan.FromMilliseconds(1260))));
}
