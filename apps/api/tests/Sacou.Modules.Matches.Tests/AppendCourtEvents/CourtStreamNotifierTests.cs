using Microsoft.Extensions.Logging;
using Sacou.Modules.Matches.AppendCourtEvents;
using Sacou.Modules.Matches.Contracts;
using Xunit;

namespace Sacou.Modules.Matches.Tests.AppendCourtEvents;

/// <summary>
/// Condition 4 of the review of E3.9 part 4a: a listener that fails after the commit is logged with the stream id and
/// the type of the exception only (never its message, nor the group or the round), and the next listener still runs.
/// </summary>
public sealed class CourtStreamNotifierTests
{
    private static readonly Guid GroupId = Guid.Parse("00000000-0000-4000-8000-000000000001");
    private static readonly Guid RoundId = Guid.Parse("00000000-0000-4000-8000-000000000002");
    private static readonly Guid StreamId = Guid.Parse("00000000-0000-4000-8000-000000000003");

    private const string Secret = "value of the database 1523.75";

    [Fact]
    public async Task FailingListener_IsLoggedByStreamAndType_AndTheNextOneRuns()
    {
        var entries = new List<(LogLevel Level, string Text)>();
        var after = new CountingListener();
        var notifier = new CourtStreamNotifier([new FailingListener(), after], new CapturingLogger(entries));

        await notifier.NotifyAsync(GroupId, RoundId, StreamId, TestContext.Current.CancellationToken);

        var (level, text) = Assert.Single(entries);
        Assert.Equal(LogLevel.Warning, level);
        Assert.Equal($"Court projections not refreshed after a write. Stream {StreamId}: {nameof(InvalidOperationException)}.", text);
        Assert.DoesNotContain(Secret, text, StringComparison.Ordinal);
        Assert.DoesNotContain(GroupId.ToString(), text, StringComparison.Ordinal);
        Assert.DoesNotContain(RoundId.ToString(), text, StringComparison.Ordinal);
        Assert.Equal(1, after.Calls);
    }

    [Fact]
    public async Task NoListener_LogsNothing()
    {
        var entries = new List<(LogLevel Level, string Text)>();

        await new CourtStreamNotifier([], new CapturingLogger(entries)).NotifyAsync(GroupId, RoundId, StreamId, TestContext.Current.CancellationToken);

        Assert.Empty(entries);
    }

    private sealed class FailingListener : ICourtStreamChanged
    {
        public Task CourtStreamChangedAsync(Guid groupId, Guid roundId, Guid courtSessionId, CancellationToken cancellationToken) =>
            throw new InvalidOperationException(Secret);
    }

    private sealed class CountingListener : ICourtStreamChanged
    {
        public int Calls { get; private set; }

        public Task CourtStreamChangedAsync(Guid groupId, Guid roundId, Guid courtSessionId, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.CompletedTask;
        }
    }

    private sealed class CapturingLogger(List<(LogLevel Level, string Text)> entries) : ILogger<CourtStreamNotifier>
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            ArgumentNullException.ThrowIfNull(formatter);
            Assert.Null(exception);
            entries.Add((logLevel, formatter(state, exception)));
        }
    }
}
