using System.Text.Json.Nodes;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>
/// <c>x-sacou-error-codes</c> at the root: the app turns it into the <c>ApiErrorCode</c> type, so a new code
/// without a pt-BR text does not compile (ADR 0042, D3).
/// </summary>
internal sealed class ErrorCodeCatalogDocumentTransformer : IOpenApiDocumentTransformer
{
    public const string Extension = "x-sacou-error-codes";

    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(document);
        document.Extensions ??= new Dictionary<string, IOpenApiExtension>(StringComparer.Ordinal);
        document.Extensions[Extension] = new JsonNodeExtension(new JsonArray([.. ErrorCodeCatalog.Codes().Select(code => JsonValue.Create(code))]));
        return Task.CompletedTask;
    }
}
