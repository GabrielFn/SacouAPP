using System.Collections.Immutable;

// Planted cases for the rules that only the court session domain follows (ADR 0033, D10 and D12).
// Every type holds exactly one violation, so that one cannot mask another.
namespace Sacou.Modules.Alpha.Domain.CourtSessions;

internal sealed class UsesDateTime
{
    internal long Now() => DateTime.UtcNow.Ticks;
}

internal sealed class UsesDateTimeOffset
{
    internal long Now() => DateTimeOffset.UtcNow.Ticks;
}

internal sealed class UsesTimeProvider
{
    internal long Now() => TimeProvider.System.GetTimestamp();
}

internal sealed class UsesRandom
{
    internal int Roll() => Random.Shared.Next();
}

internal sealed class UsesGuid
{
    internal string Id() => Guid.NewGuid().ToString();
}

internal sealed class UsesThread
{
    internal int Id() => Thread.CurrentThread.ManagedThreadId;
}

internal sealed class UsesTask
{
    internal bool Done() => Task.CompletedTask.IsCompleted;
}

internal sealed class UsesParallel
{
    internal bool Run() => Parallel.For(0, 1, _ => { }).IsCompleted;
}

internal sealed class UsesHashSet
{
    internal int Count(IEnumerable<int> items) => new HashSet<int>(items).Count;
}

internal sealed class UsesDictionary
{
    internal int Count(IEnumerable<string> items) => items.ToDictionary(item => item, item => item.Length).Count;
}

internal sealed class AllowedImmutableCollections
{
    internal int Count(IEnumerable<string> items) =>
        items.ToImmutableHashSet(StringComparer.Ordinal).Count
        + items.ToImmutableDictionary(item => item, item => item.Length, StringComparer.Ordinal).Count;
}

internal sealed record WithNickname(string Nickname);

internal sealed record WithOwnerUserId(string OwnerUserId);

internal sealed record WithUppercasePix(string PIX);

internal sealed class WithEmailField
{
    private readonly string _email = string.Empty;

    internal int Length => _email.Length;
}

internal sealed record AllowedMemberIds(string MemberId, string Pixel, int NameCount);

internal sealed class WithNicknameParameter(string nickname)
{
    internal int Length { get; } = nickname.Length;
}

// The general domain rule covers the court sessions too: these must be reported by it.
internal sealed class UsesEnvironmentInCourtSessions
{
    internal string Host() => Environment.MachineName;
}

internal sealed class UsesStopwatchInCourtSessions
{
    internal long Now() => System.Diagnostics.Stopwatch.GetTimestamp();
}
