using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>
/// Every status an endpoint declares with <c>ProducesProblem</c> is a rule error (403, 404, 409 and the
/// validation 400): its body is <c>ApiProblem</c>, with a <c>code</c> (ADR 0039).
/// </summary>
internal sealed class RuleProblemOperationTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(operation);
        ArgumentNullException.ThrowIfNull(context);
        foreach (var response in (operation.Responses ?? []).Values.OfType<OpenApiResponse>())
        {
            if (response.Content?.ContainsKey(ProblemSchemas.ContentType) == true)
            {
                response.Content = new Dictionary<string, OpenApiMediaType>(StringComparer.Ordinal)
                {
                    [ProblemSchemas.ContentType] = ProblemSchemas.Body(ProblemSchemas.ApiProblemId, context.Document),
                };
            }
        }

        return Task.CompletedTask;
    }
}
