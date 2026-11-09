using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Sacou.Shared.Results;

namespace Sacou.Http;

/// <summary>Turns a <see cref="Result{T}"/> into a typed HTTP result, so the endpoint declares both shapes for OpenAPI.</summary>
public static class ResultHttpExtensions
{
    public static Results<TSuccess, ProblemHttpResult> ToHttpResult<T, TSuccess>(this Result<T> result, Func<T, TSuccess> onSuccess)
        where T : notnull
        where TSuccess : IResult
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(onSuccess);
        return result.Match<Results<TSuccess, ProblemHttpResult>>(
            value => onSuccess(value),
            error => ProblemResults.From(error));
    }
}
