using System.Reflection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;

namespace Sacou.Api.Tests.OpenApi;

/// <summary>
/// C7 (E4.2): a <c>ProblemHttpResult</c> does not tell the contract its status, so an endpoint that can answer
/// one (its handler returns it, or it sits behind the group access filter) must declare at least one
/// <c>ProducesProblem</c>. It only catches a missing declaration, not a forgotten status.
/// </summary>
internal static class ProblemContractGuard
{
    private const string GroupIdParameter = "groupId";
    private const int FirstErrorStatus = 400;

    public static IReadOnlyList<string> Violations(IEnumerable<Endpoint> endpoints) =>
        [.. endpoints.OfType<RouteEndpoint>()
            .Where(CanAnswerAProblem)
            .Where(endpoint => !endpoint.Metadata.OfType<IProducesResponseTypeMetadata>().Any(produced => produced.StatusCode >= FirstErrorStatus))
            .Select(endpoint => $"{endpoint.RoutePattern.RawText}: can answer a problem but declares no ProducesProblem")];

    private static bool CanAnswerAProblem(RouteEndpoint endpoint) =>
        endpoint.RoutePattern.GetParameter(GroupIdParameter) is not null
        || endpoint.Metadata.OfType<MethodInfo>().Any(handler => Mentions(handler.ReturnType, typeof(ProblemHttpResult)));

    private static bool Mentions(Type type, Type wanted) =>
        type == wanted || (type.IsGenericType && type.GetGenericArguments().Any(argument => Mentions(argument, wanted)));
}
