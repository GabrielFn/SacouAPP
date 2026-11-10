using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>Puts the two error bodies in the components, in place of what the generator made of the MVC types.</summary>
internal sealed class ProblemSchemaDocumentTransformer : IOpenApiDocumentTransformer
{
    private const string ValidationProblemId = "HttpValidationProblemDetails";

    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(document);
        var components = document.Components ??= new OpenApiComponents();
        var schemas = new SortedDictionary<string, IOpenApiSchema>(
            components.Schemas ?? new Dictionary<string, IOpenApiSchema>(), StringComparer.Ordinal)
        {
            [ProblemSchemas.ApiProblemId] = ProblemSchemas.ApiProblem(),
            [ProblemSchemas.ProblemDetailsId] = ProblemSchemas.ProblemDetails(),
        };
        schemas.Remove(ValidationProblemId);
        components.Schemas = schemas;
        return Task.CompletedTask;
    }
}
