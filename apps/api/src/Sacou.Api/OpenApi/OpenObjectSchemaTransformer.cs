using System.Text.Json.Nodes;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>
/// A <see cref="JsonObject"/> answer (the personal data export of E3.16, whose sections each module adds) comes out
/// as a bare <c>type: object</c>, which the app's generator reads as "no keys at all". This says what the wire has:
/// any key, any value (<c>additionalProperties: {}</c>), so the app types it as a record of unknown values.
/// </summary>
internal sealed class OpenObjectSchemaTransformer : IOpenApiSchemaTransformer
{
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(schema);
        ArgumentNullException.ThrowIfNull(context);
        if (context.JsonTypeInfo.Type == typeof(JsonObject))
        {
            schema.Type = JsonSchemaType.Object;
            schema.AdditionalPropertiesAllowed = true;
            schema.AdditionalProperties = new OpenApiSchema();
        }

        return Task.CompletedTask;
    }
}
