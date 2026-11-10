using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>
/// The web JSON defaults also read a number written as a string, so the generator describes every number as
/// <c>integer | string</c> with a pattern. The API always writes a JSON number and the app always sends one:
/// the contract says a number, and the generated types stay <c>number</c> (ADR 0042, D1).
/// </summary>
internal sealed class NumberAsNumberSchemaTransformer : IOpenApiSchemaTransformer
{
    private const JsonSchemaType Numeric = JsonSchemaType.Integer | JsonSchemaType.Number;

    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(schema);
        if (schema.Type is { } type && (type & Numeric) != 0 && type.HasFlag(JsonSchemaType.String))
        {
            schema.Type = type & ~JsonSchemaType.String;
            schema.Pattern = null;
        }

        return Task.CompletedTask;
    }
}
