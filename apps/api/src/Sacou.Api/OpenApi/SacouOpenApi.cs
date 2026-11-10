namespace Sacou.Api.OpenApi;

/// <summary>
/// The one OpenAPI document of the API, <c>v1</c>, and the transformers that make it say what the wire says
/// (ADR 0042). Mapped only in Development: the app compiles its types from the committed file, never from a
/// running API.
/// </summary>
internal static class SacouOpenApi
{
    public const string DocumentName = "v1";
    public const string Route = "/openapi/{documentName}.json";

    public static IServiceCollection AddSacouOpenApi(this IServiceCollection services) =>
        services.AddOpenApi(DocumentName, options => options
            .AddSchemaTransformer<EnumAsTextSchemaTransformer>()
            .AddSchemaTransformer<NumberAsNumberSchemaTransformer>()
            .AddOperationTransformer<RouteParameterOperationTransformer>()
            .AddOperationTransformer<RuleProblemOperationTransformer>()
            .AddOperationTransformer<CommonResponsesOperationTransformer>()
            .AddDocumentTransformer<ProblemSchemaDocumentTransformer>()
            .AddDocumentTransformer<ErrorCodeCatalogDocumentTransformer>()
            .AddDocumentTransformer<PublicSurfaceDocumentTransformer>());
}
