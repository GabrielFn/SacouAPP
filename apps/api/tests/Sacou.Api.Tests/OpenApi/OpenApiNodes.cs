using System.Text.Json.Nodes;

namespace Sacou.Api.Tests.OpenApi;

/// <summary>Walks the served document as plain JSON, so the tests read what the app reads, not the C# model.</summary>
internal static class OpenApiNodes
{
    public const string ApiProblem = "#/components/schemas/ApiProblem";
    public const string ProblemDetails = "#/components/schemas/ProblemDetails";
    public const string ProblemContent = "application/problem+json";

    public static IEnumerable<(string Method, string Path, JsonObject Node)> Operations(JsonObject document) =>
        from path in document["paths"]!.AsObject()
        from operation in path.Value!.AsObject()
        select (operation.Key, path.Key, operation.Value!.AsObject());

    public static IEnumerable<(string Status, JsonObject Node)> Responses(JsonObject operation) =>
        operation["responses"]!.AsObject().Select(response => (response.Key, response.Value!.AsObject()));

    public static JsonObject Schemas(JsonObject document) => document["components"]!["schemas"]!.AsObject();

    public static JsonObject Response(JsonObject operation, string status) =>
        operation["responses"]?[status]?.AsObject() ?? throw new InvalidOperationException($"no {status} response");

    public static string? ProblemReference(JsonObject response) => (string?)response["content"]?[ProblemContent]?["schema"]?["$ref"];

    public static string SchemaId(string reference) => reference[(reference.LastIndexOf('/') + 1)..];
}
