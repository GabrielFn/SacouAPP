using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using HttpJsonOptions = Microsoft.AspNetCore.Http.Json.JsonOptions;

namespace Sacou.Api.OpenApi;

/// <summary>
/// The schema generator does not see through the API's own enum converter and leaves the schema empty. This
/// writes <c>type: string</c> and the values the API really sends: each member serialized with the same
/// options as every response, so the contract never drifts from the wire (ADR 0042, D1).
/// </summary>
internal sealed class EnumAsTextSchemaTransformer(IOptions<HttpJsonOptions> json) : IOpenApiSchemaTransformer
{
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(schema);
        ArgumentNullException.ThrowIfNull(context);
        // A nullable enum (`PrimaryPosition?`) reaches here as Nullable<T>: its component is still the enum, and the
        // property wraps it in oneOf with null.
        var type = Nullable.GetUnderlyingType(context.JsonTypeInfo.Type) ?? context.JsonTypeInfo.Type;
        if (type.IsEnum)
        {
            schema.Type = JsonSchemaType.String;
            schema.Enum = [.. WireValues(type, json.Value.SerializerOptions)];
        }
        else if (EnumElementType(type) is { } element && schema.Items is null)
        {
            // A list of enums (`otherPositions`) comes out with no `items` at all: describe each item inline.
            schema.Items = new OpenApiSchema { Type = JsonSchemaType.String, Enum = [.. WireValues(element, json.Value.SerializerOptions)] };
        }

        return Task.CompletedTask;
    }

    private static Type? EnumElementType(Type type) =>
        type.IsArray ? EnumOrNull(type.GetElementType())
        : type.IsGenericType && typeof(System.Collections.IEnumerable).IsAssignableFrom(type) && type.GetGenericArguments() is [var argument] ? EnumOrNull(argument)
        : null;

    private static Type? EnumOrNull(Type? type) => type is { IsEnum: true } ? type : null;

    public static IEnumerable<JsonNode> WireValues(Type enumType, JsonSerializerOptions options) =>
        Enum.GetValues(enumType).Cast<object>().Select(value => JsonSerializer.SerializeToNode(value, enumType, options)!);
}
