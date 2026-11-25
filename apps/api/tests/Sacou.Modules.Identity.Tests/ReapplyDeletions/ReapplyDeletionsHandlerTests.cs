using Microsoft.Extensions.Logging.Abstractions;
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
        groups.WithoutAdmin = [Guid.NewGuid()];

        var summary = (await HandleAsync(Now.AddDays(-1), Mark(1))).Value;

        Assert.Equal(2, summary.GroupsWithoutAdmin);
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

    private Task<Result<ReapplyDeletionsSummary>> HandleAsync(DateTimeOffset dumpCreatedAt, params DeletionMark[] marks) =>
        new ReapplyDeletionsHandler(
                new FakeSource(marks), restored, restored, [notifications, groups], new FixedTimeProvider(Now), NullLogger<ReapplyDeletionsHandler>.Instance)
            .HandleAsync(Source, dumpCreatedAt, TestContext.Current.CancellationToken);

    private static DeletionMark Mark(byte seed) => new([.. Enumerable.Repeat(seed, SubjectHash.Length)], Now.AddDays(-seed));

    private sealed class FakeSource(IReadOnlyList<DeletionMark> marks) : IDeletionMarkSource
    {
        public Task<IReadOnlyList<DeletionMark>> ReadAllAsync(string connectionString, CancellationToken cancellationToken)
        {
            Assert.Equal(Source, connectionString);
            return Task.FromResult(marks);
        }
    }

    /// <summary>The restored database: its marks, by hash, and its accounts, which any mark matches while they exist.</summary>
    private sealed class FakeRestored(List<string> steps) : IRestoredAccounts, IDeletedAccountStore
    {
        private readonly HashSet<string> marks = new(StringComparer.Ordinal);
        private readonly List<MarkedAccount> accounts = [];

        public int MarkCount => marks.Count;

        public MarkedAccount Add(string uid)
        {
            var account = new MarkedAccount(new UserId(Guid.CreateVersion7(Now.AddSeconds(accounts.Count))), AuthSubject.Create(uid).Value);
            accounts.Add(account);
            return account;
        }

        public Task<int> CopyMarksAsync(IReadOnlyList<DeletionMark> copied, CancellationToken cancellationToken) =>
            Task.FromResult(copied.Count(mark => marks.Add(Convert.ToHexString(mark.SubjectHash))));

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

        public IReadOnlyList<Guid> WithoutAdmin { get; set; } = [];

        public Task<IReadOnlyList<Guid>> EraseAsync(Guid userId, ErasureMode mode, CancellationToken cancellationToken)
        {
            Modes.Add(mode);
            steps.Add($"{module} {userId}");
            return Task.FromResult(WithoutAdmin);
        }
    }
}
