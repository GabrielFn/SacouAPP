using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Modules.Identity.Infrastructure;
using Sacou.Modules.Identity.ReapplyDeletions;
using Sacou.Shared.Results;
using Sacou.Tests.TestSupport;
using Xunit;

namespace Sacou.Modules.Identity.Tests.ReapplyDeletions;

/// <summary>The steps of the reapply (E6.3, criteria 1, 2, 4, 5 and 13), with the databases and the modules faked.</summary>
public sealed class ReapplyDeletionsHandlerTests
{
    private const string Source = "Host=current;Database=sacou";
    private const string SourceDatabase = "sacou/16384/5432/1764000000.1";
    private const string TargetDatabase = "sacou/16385/5432/1764000000.1";
    private const int MinutesPerDay = 24 * 60;
    private const int RetentionMinutes = DeletionMarkRetention.Days * MinutesPerDay;

    private static readonly DateTimeOffset Now = new(2026, 11, 25, 12, 0, 0, TimeSpan.Zero);

    private readonly List<string> steps = [];

    private readonly FakeRestored restored;

    private readonly RecordingErasure notifications;

    private readonly RecordingErasure groups;

    public ReapplyDeletionsHandlerTests()
    {
        restored = new FakeRestored(steps);
        notifications = new RecordingErasure("notifications", steps);
        groups = new RecordingErasure("groups", steps);
    }

    /// <summary>The modules first, in their order, then the user: a failure in between leaves the account for the next run.</summary>
    [Fact]
    public async Task EachMarkedAccount_IsErasedByEveryModule_ThenDeleted_InIdOrder()
    {
        var first = restored.Add("uid-a");
        var second = restored.Add("uid-b");

        var summary = (await HandleAsync(Now.AddDays(-1), Mark(1), Mark(2), Mark(3))).Value;

        string[] expected =
        [
            $"notifications {first.User.Value}", $"groups {first.User.Value}", $"delete {first.User.Value}",
            $"notifications {second.User.Value}", $"groups {second.User.Value}", $"delete {second.User.Value}",
        ];
        Assert.Equal(expected, steps);
        Assert.All(notifications.Modes.Concat(groups.Modes), mode => Assert.Equal(ErasureMode.AfterRestore, mode));
        Assert.Equal((3, 3, 2, 0), (summary.Marks, summary.NewMarks, summary.AccountsErased, summary.GroupsWithoutAdmin));
    }

    [Fact]
    public async Task SecondRun_FindsNothingNew()
    {
        restored.Add("uid-a");
        _ = await HandleAsync(Now.AddDays(-1), Mark(1));
        steps.Clear();

        var again = (await HandleAsync(Now.AddDays(-1), Mark(1))).Value;

        Assert.Equal((1, 0, 0), (again.Marks, again.NewMarks, again.AccountsErased));
        Assert.Empty(steps);
    }

    [Fact]
    public async Task AccountGoneBeforeTheDump_OnlyTheMarkIsKept()
    {
        var summary = (await HandleAsync(Now.AddDays(-1), Mark(1))).Value;

        Assert.Equal((1, 1, 0), (summary.Marks, summary.NewMarks, summary.AccountsErased));
        Assert.Empty(steps);
    }

    [Fact]
    public async Task GroupsLeftWithoutAdmin_AreAddedUpAcrossAccounts()
    {
        restored.Add("uid-a");
        restored.Add("uid-b");
        groups.WithoutAdminPerCall = [[Guid.NewGuid()], [Guid.NewGuid()]];

        var summary = (await HandleAsync(Now.AddDays(-1), Mark(1))).Value;

        Assert.Equal(2, summary.GroupsWithoutAdmin);
    }

    /// <summary>Two admins of one group both went: the group counts once, in any module that reports it.</summary>
    [Fact]
    public async Task OneGroupReportedTwice_CountsOnce()
    {
        restored.Add("uid-a");
        restored.Add("uid-b");
        var group = Guid.NewGuid();
        groups.WithoutAdminPerCall = [[group], [group]];
        notifications.WithoutAdminPerCall = [[group]];

        var summary = (await HandleAsync(Now.AddDays(-1), Mark(1))).Value;

        Assert.Equal(1, summary.GroupsWithoutAdmin);
    }

    /// <summary>59 days and 23 hours runs; exactly 60 days runs; 60 days and 1 minute is refused, with nothing written.</summary>
    [Theory]
    [InlineData(RetentionMinutes - 60, true)]
    [InlineData(RetentionMinutes, true)]
    [InlineData(RetentionMinutes + 1, false)]
    public async Task DumpOlderThanTheRetention_IsRefused_BeforeAnyWrite(int minutesAgo, bool runs)
    {
        restored.Add("uid-a");

        var result = await HandleAsync(Now.AddMinutes(-minutesAgo), Mark(1));

        Assert.Equal(runs, result.IsSuccess);
        Assert.Equal(runs ? 1 : 0, restored.MarkCount);
        if (!runs)
        {
            Assert.Equal(ReapplyDeletionsRefusals.DumpOlderThanRetention, result.Error);
            Assert.Empty(steps);
        }
    }

    /// <summary>Criteria 11 and 12 (S2): a source that cannot be read, or whose role can write, is refused before any write.</summary>
    [Fact]
    public async Task UnreadableOrWritableSource_IsRefused_BeforeAnyWrite()
    {
        restored.Add("uid-a");

        foreach (var refusal in new[] { ReapplyDeletionsRefusals.SourceUnreadable, ReapplyDeletionsRefusals.SourceCanWrite })
        {
            var result = await HandleAsync(new FakeSource(refusal), Now.AddDays(-1));

            Assert.Equal(refusal, result.Error);
        }

        Assert.Equal(0, restored.MarkCount);
        Assert.Empty(steps);
    }

    /// <summary>Criterion 11 after connecting: the server says the source is the restored database itself, so nothing is written.</summary>
    [Fact]
    public async Task SourceThatIsTheRestoredDatabase_IsRefused_BeforeAnyWrite()
    {
        restored.Add("uid-a");

        var result = await HandleAsync(new FakeSource([Mark(1)], TargetDatabase), Now.AddDays(-1));

        Assert.Equal(ReapplyDeletionsRefusals.SourceIsTarget, result.Error);
        Assert.Equal(0, restored.MarkCount);
        Assert.Empty(steps);
    }

    /// <summary>A database failure of the restored database before the erasures is an interruption (exit 5), never a crash.</summary>
    [Fact]
    public async Task TargetFailureBeforeTheErasures_IsInterrupted()
    {
        restored.Add("uid-a");
        restored.FailCopy = true;

        var result = await HandleAsync(Now.AddDays(-1), Mark(1));

        Assert.Equal(ReapplyDeletionsRefusals.Interrupted, result.Error);
        Assert.Empty(steps);
    }

    /// <summary>
    /// The swap guard (S2): a mark of the restored database the source lacks, younger than the retention, means the source
    /// is the older one. An older mark the source no longer has (the purge of E6.5) does not count.
    /// </summary>
    [Theory]
    [InlineData(RetentionMinutes - 1, false)]
    [InlineData(RetentionMinutes + 1, true)]
    public async Task RestoredMarkTheSourceLacks_IsRefusedOnlyWhileTheRetentionKeepsIt(int minutesAgo, bool runs)
    {
        restored.AddMark(new DeletionMark([.. Enumerable.Repeat((byte)9, SubjectHash.Length)], Now.AddMinutes(-minutesAgo)));
        restored.Add("uid-a");

        var result = await HandleAsync(Now.AddDays(-1), Mark(1));

        Assert.Equal(runs, result.IsSuccess);
        Assert.Equal(runs ? 2 : 1, restored.MarkCount);
        if (!runs)
        {
            Assert.Equal(ReapplyDeletionsRefusals.TargetAheadOfSource, result.Error);
            Assert.Empty(steps);
        }
    }

    /// <summary>Criterion 14: a database failure at the 2nd account of 3 stops the run at 1 of 3; the next run erases the 2 left.</summary>
    [Fact]
    public async Task FailureInTheMiddle_StopsThere_AndTheNextRunFinishes()
    {
        restored.Add("uid-a");
        var second = restored.Add("uid-b");
        restored.Add("uid-c");
        groups.FailOnCall = 1;

        var interrupted = (await HandleAsync(Now.AddDays(-1), Mark(1))).Value;

        Assert.False(interrupted.IsComplete);
        Assert.Equal((1, 3), (interrupted.AccountsErased, interrupted.AccountsFound));
        Assert.DoesNotContain($"delete {second.User.Value}", steps);

        groups.FailOnCall = null;
        var resumed = (await HandleAsync(Now.AddDays(-1), Mark(1))).Value;

        Assert.True(resumed.IsComplete);
        Assert.Equal((0, 2, 2), (resumed.NewMarks, resumed.AccountsErased, resumed.AccountsFound));
    }

    private Task<Result<ReapplyDeletionsSummary>> HandleAsync(DateTimeOffset dumpCreatedAt, params DeletionMark[] marks) =>
        HandleAsync(new FakeSource(marks), dumpCreatedAt);

    private Task<Result<ReapplyDeletionsSummary>> HandleAsync(FakeSource source, DateTimeOffset dumpCreatedAt) =>
        new ReapplyDeletionsHandler(
                source, restored, restored, [notifications, groups], new FixedTimeProvider(Now), NullLogger<ReapplyDeletionsHandler>.Instance)
            .HandleAsync(Source, dumpCreatedAt, TestContext.Current.CancellationToken);

    private static DeletionMark Mark(byte seed) => new([.. Enumerable.Repeat(seed, SubjectHash.Length)], Now.AddDays(-seed));

    private sealed class FakeSource : IDeletionMarkSource
    {
        private readonly Result<SourceMarks> read;

        public FakeSource(IReadOnlyList<DeletionMark> marks, string database = SourceDatabase) => read = Result.Success(new SourceMarks(database, marks));

        public FakeSource(Error refusal) => read = Result.Failure<SourceMarks>(refusal);

        public Task<Result<SourceMarks>> ReadAllAsync(string connectionString, CancellationToken cancellationToken)
        {
            Assert.Equal(Source, connectionString);
            return Task.FromResult(read);
        }
    }

    /// <summary>The restored database: its marks, by hash, and its accounts, which any mark matches while they exist.</summary>
    private sealed class FakeRestored(List<string> steps) : IRestoredAccounts, IDeletedAccountStore
    {
        private readonly Dictionary<string, DateTimeOffset> marks = new(StringComparer.Ordinal);
        private readonly List<MarkedAccount> accounts = [];

        public int MarkCount => marks.Count;

        public MarkedAccount Add(string uid)
        {
            var account = new MarkedAccount(new UserId(Guid.CreateVersion7(Now.AddSeconds(accounts.Count))), AuthSubject.Create(uid).Value);
            accounts.Add(account);
            return account;
        }

        public void AddMark(DeletionMark mark) => marks.Add(Convert.ToHexString(mark.SubjectHash), mark.DeletedAt);

        /// <summary>When set, copying the marks fails as a lost connection would.</summary>
        public bool FailCopy { get; set; }

        public Task<string> DatabaseAsync(CancellationToken cancellationToken) => Task.FromResult(TargetDatabase);

        public Task<long> CountMarksMissingFromAsync(IReadOnlyList<DeletionMark> sourceMarks, DateTimeOffset since, CancellationToken cancellationToken)
        {
            var inSource = sourceMarks.Select(mark => Convert.ToHexString(mark.SubjectHash)).ToHashSet(StringComparer.Ordinal);
            return Task.FromResult((long)marks.Count(mark => mark.Value >= since && !inSource.Contains(mark.Key)));
        }

        public Task<int> CopyMarksAsync(IReadOnlyList<DeletionMark> copied, CancellationToken cancellationToken) => FailCopy
            ? throw new NpgsqlException("connection lost")
            : Task.FromResult(copied.Count(mark => marks.TryAdd(Convert.ToHexString(mark.SubjectHash), mark.DeletedAt)));

        public Task<IReadOnlyList<MarkedAccount>> FindMarkedAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<MarkedAccount>>(marks.Count == 0 ? [] : [.. accounts.OrderBy(account => account.User.Value)]);

        public Task<bool> IsDeletedAsync(AuthSubject subject, CancellationToken cancellationToken) => throw new NotSupportedException();

        public Task DeleteAsync(UserId user, AuthSubject subject, DateTimeOffset now, CancellationToken cancellationToken)
        {
            Assert.Equal(accounts.Single(account => account.User == user).Subject, subject);
            steps.Add($"delete {user.Value}");
            _ = accounts.RemoveAll(account => account.User == user);
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingErasure(string module, List<string> steps) : IAccountErasure
    {
        public List<ErasureMode> Modes { get; } = [];

        /// <summary>What each call returns, in order; empty once the list runs out.</summary>
        public IReadOnlyList<IReadOnlyList<Guid>> WithoutAdminPerCall { get; set; } = [];

        /// <summary>The 0-based call that fails as a lost connection would; null never fails.</summary>
        public int? FailOnCall { get; set; }

        public Task<IReadOnlyList<Guid>> EraseAsync(Guid userId, ErasureMode mode, CancellationToken cancellationToken)
        {
            var call = Modes.Count;
            Modes.Add(mode);
            if (call == FailOnCall)
            {
                throw new NpgsqlException("connection lost");
            }

            steps.Add($"{module} {userId}");
            return Task.FromResult(call < WithoutAdminPerCall.Count ? WithoutAdminPerCall[call] : (IReadOnlyList<Guid>)[]);
        }
    }
}
