using Microsoft.AspNetCore.Http;
using Sacou.Shared.Results;

namespace Sacou.Http;

/// <summary>
/// The shape shared by the access filters of the modules (ADR 0040, D3): resolve who may do what, answer
/// with a <c>ProblemDetails</c> and stop, or hand the proof to the handler through the request's features.
/// A subclass only says how to resolve; it fails closed when an endpoint declares no requirement.
/// </summary>
public abstract class AccessFilter<TAccess> : IEndpointFilter
    where TAccess : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);
        var http = context.HttpContext;
        var access = await ResolveAsync(http).ConfigureAwait(false);
        if (access.IsFailure)
        {
            return ProblemResults.From(access.Error);
        }

        http.Features.Set(access.Value);
        return await next(context).ConfigureAwait(false);
    }

    protected abstract Task<Result<TAccess>> ResolveAsync(HttpContext http);

    /// <summary>The one requirement an endpoint declares in its metadata. More or fewer than one is a 500, never a free pass.</summary>
    protected static TRequirement Declared<TRequirement>(HttpContext http)
        where TRequirement : class
    {
        ArgumentNullException.ThrowIfNull(http);
        var declared = http.GetEndpoint()?.Metadata.GetOrderedMetadata<TRequirement>() ?? [];
        return declared.Count == 1
            ? declared[0]
            : throw new InvalidOperationException($"An endpoint must declare exactly one {typeof(TRequirement).Name}.");
    }
}
