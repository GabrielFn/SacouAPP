using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Sacou.Tests.TestSupport;

/// <summary>Keeps every log message and scope, at every level, so a test can prove what never reaches a log.</summary>
internal sealed class CollectingLoggerProvider : ILoggerProvider
{
    private readonly ConcurrentQueue<string> entries = new();

    public IReadOnlyList<string> Entries => [.. entries];

    public ILogger CreateLogger(string categoryName) => new CollectingLogger(categoryName, entries);

    public void Dispose()
    {
    }

    private sealed class CollectingLogger(string category, ConcurrentQueue<string> entries) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull
        {
            entries.Enqueue($"{category} scope: {state}");
            return null;
        }

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            entries.Enqueue($"{category} {logLevel}: {formatter(state, exception)} {exception}");
        }
    }
}
