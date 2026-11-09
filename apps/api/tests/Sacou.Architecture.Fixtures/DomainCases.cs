using System.Collections.Immutable;
using System.Data;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Sacou.Shared.Results;

// Every type holds exactly one violation, so that one cannot mask another.
// Each case uses the forbidden type in a way the compiler keeps even in optimized builds.
namespace Sacou.Modules.Alpha.Domain;

internal sealed class HttpInSignature
{
    internal void Handle(HttpContext context) { }
}

internal sealed class HttpInField
{
    private readonly HttpContext? _context = null;

    internal bool HasContext => _context is not null;
}

internal sealed class HttpInBaseType() : Endpoint(null, null, null);

internal sealed class HttpInGenericArgumentOfSignature
{
    internal IReadOnlyList<HttpContext> Contexts() => [];
}

internal sealed class HttpInGenericArgumentOfCall
{
    internal int Count() => Array.Empty<HttpContext>().Length;
}

[Authorize]
internal sealed class HttpInAttribute;

internal sealed class HttpInMethodBody
{
    internal string Trace() => new DefaultHttpContext().TraceIdentifier;
}

internal sealed class HttpInLambda
{
    internal string Trace()
    {
        Func<string> trace = () => new DefaultHttpContext().TraceIdentifier;
        return trace();
    }
}

internal sealed class HttpInAsyncMethod
{
    internal async Task<string> Trace()
    {
        await Task.Yield();
        return new DefaultHttpContext().TraceIdentifier;
    }
}

internal sealed class HttpInIterator
{
    internal IEnumerable<string> Traces()
    {
        yield return new DefaultHttpContext().TraceIdentifier;
    }
}

internal sealed class LoggingOutsideAnyBlockList
{
    internal void Handle(ILogger logger) { }
}

internal sealed class NetHttpClient
{
    internal int Count()
    {
        using var client = new HttpClient();
        return client.DefaultRequestHeaders.Count();
    }
}

internal sealed class SystemData
{
    internal string Name() => new DataTable().TableName;
}

internal sealed class FileAccess
{
    internal bool Exists(string path) => File.Exists(path);
}

internal sealed class EnvironmentAccess
{
    internal string Host() => Environment.MachineName;
}

// Only the signature: reading the enum value would be folded into a constant.
internal sealed class EnvironmentNestedType
{
    internal void Handle(Environment.SpecialFolder folder) { }
}

internal sealed class ConsoleAccess
{
    internal void Print(string text) => Console.WriteLine(text);
}

internal sealed class AppContextAccess
{
    internal string Directory() => AppContext.BaseDirectory;
}

internal sealed class AppDomainAccess
{
    internal string Name() => AppDomain.CurrentDomain.FriendlyName;
}

internal sealed class ActivatorAccess
{
    internal object Create() => Activator.CreateInstance<object>();
}

internal sealed class GcAccess
{
    internal void Collect() => GC.Collect();
}

internal sealed class ProcessAccess
{
    internal int Id()
    {
        using var process = Process.GetCurrentProcess();
        return process.Id;
    }
}

// Not Debug.Assert: that call vanishes in Release.
internal sealed class StopwatchAccess
{
    internal long Now() => Stopwatch.GetTimestamp();
}

internal sealed class MarshalAccess
{
    internal int Size() => Marshal.SizeOf<int>();
}

internal sealed class NativeLibraryAccess
{
    internal nint Main() => NativeLibrary.GetMainProgramHandle();
}

internal static class PInvokeInStaticMethod
{
    [DllImport("kernel32")]
    internal static extern uint GetTickCount();
}

internal static class PInvokeInNestedType
{
    internal static class Native
    {
        [DllImport("kernel32")]
        internal static extern uint GetTickCount();
    }
}

internal sealed record AllowedRecord(int Id, string Name);

internal readonly record struct AllowedRecordStruct(int Id, string Name);

internal abstract record AllowedClosedHierarchy
{
    private AllowedClosedHierarchy()
    {
    }

    internal sealed record First(ImmutableArray<int> Items) : AllowedClosedHierarchy;

    internal sealed record Second : AllowedClosedHierarchy;
}

/// <summary>Every shape of collection expression, each lowered to different compiler output.</summary>
internal sealed class AllowedCollectionExpressions
{
    internal List<int> AsList(int item) => [item, item];

    internal List<int> AsListWithSpread(IEnumerable<int> items, int item) => [.. items, item];

    internal ImmutableArray<int> AsImmutableArray(int item) => [item, item];

    internal ImmutableArray<int> AsImmutableArrayOfConstants() => [1, 2, 3];

    internal IReadOnlyList<int> AsReadOnlyList(int item) => [item, item];

    internal int[] AsArray(int item) => [item, item];

    internal int SumOfSpan(int item)
    {
        ReadOnlySpan<int> span = [item, item, item];
        var total = 0;
        foreach (var value in span)
        {
            total += value;
        }

        return total;
    }

    internal int LengthOfConstantSpan()
    {
        ReadOnlySpan<int> span = [1, 2, 3];
        return span.Length;
    }

    internal int LengthOfMutableSpan(string item)
    {
        Span<string> span = [item, item];
        return span.Length;
    }
}

internal sealed class AllowedSameDomainDependency
{
    internal AllowedBclAndShared Sibling { get; } = new();
}

internal sealed class AllowedGeneric<T>
    where T : notnull
{
    internal IReadOnlyList<T> Wrap(T item) => [item];
}

internal sealed class AllowedBclAndShared
{
    internal Guid Id { get; } = Guid.NewGuid();

    internal async Task<Result<int>> ResolveAsync(ImmutableArray<int> numbers)
    {
        await Task.Yield();
        var total = numbers.Select(number => number * 2).Sum();
        return total > 0
            ? Result.Success(total)
            : Result.Failure<int>(new Error("alpha.empty", ErrorKind.Validation));
    }

    internal IEnumerable<string> Names(IReadOnlyDictionary<string, string> names)
    {
        foreach (var pair in names)
        {
            yield return $"{pair.Key}:{pair.Value}";
        }
    }
}

// Sacou.Http is not Sacou.Shared: the domain must not map its own errors to HTTP (ADR 0039).
internal sealed class HttpProjectInDomain
{
    internal object Map(Error error) => Sacou.Http.ProblemResults.From(error);
}
