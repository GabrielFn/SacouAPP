using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>
/// The two error bodies of the API. <c>ApiProblem</c> is every rule error (ADR 0039): the app translates it by
/// <c>code</c>. <c>ProblemDetails</c> comes from the pipeline (no token, signing keys out of reach, a body that
/// does not bind), where there is no rule; a rule 400 shares its status, so its <c>code</c> is optional there.
/// </summary>
internal static class ProblemSchemas
{
    public const string ApiProblemId = "ApiProblem";
    public const string ProblemDetailsId = "ProblemDetails";
    public const string ContentType = "application/problem+json";
    public const string CodeField = "code";

    private const string TypeField = "type";
    private const string TitleField = "title";
    private const string StatusField = "status";
    private const string TraceIdField = "traceId";
    private const string Int32Format = "int32";

    public static OpenApiSchema ApiProblem() => Build([TitleField, StatusField, CodeField]);

    public static OpenApiSchema ProblemDetails() => Build([TitleField, StatusField]);

    public static OpenApiMediaType Body(string schemaId, OpenApiDocument? document) =>
        new() { Schema = new OpenApiSchemaReference(schemaId, document) };

    private static OpenApiSchema Build(string[] required) => new()
    {
        Type = JsonSchemaType.Object,
        Properties = new Dictionary<string, IOpenApiSchema>(StringComparer.Ordinal)
        {
            [TypeField] = Text(),
            [TitleField] = Text(),
            [StatusField] = new OpenApiSchema { Type = JsonSchemaType.Integer, Format = Int32Format },
            [CodeField] = Text(),
            [TraceIdField] = Text(),
        },
        Required = new SortedSet<string>(required, StringComparer.Ordinal),
    };

    private static OpenApiSchema Text() => new() { Type = JsonSchemaType.String };
}
