using System.Collections.Immutable;
using System.Data;
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
