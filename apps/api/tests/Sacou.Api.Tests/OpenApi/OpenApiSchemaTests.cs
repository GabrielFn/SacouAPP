using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Groups.Contracts;
using Sacou.Shared.Results;
using Xunit;

namespace Sacou.Api.Tests.OpenApi;

/// <summary>C3 to C6 and C8 to C10 (E4.2): the document describes the wire, field by field and error by error.</summary>
public sealed partial class OpenApiSchemaTests
{
    private const string ErrorsSuffix = "Errors";
    private const string ModuleAssemblyPattern = "Sacou.Modules.*.dll";

    /// <summary>Literal, so a converter that changes the naming policy fails even though the transformer follows it.</summary>
    [Theory]
    [InlineData(typeof(GroupRole), new[] { "admin", "coAdmin", "scorekeeper", "player" })]
    [InlineData(typeof(MemberType), new[] { "regular", "dropIn" })]
    [InlineData(typeof(Sacou.Modules.Identity.Contracts.PrimaryPosition), new[] { "any", "setter", "outsideHitter", "opposite", "middleBlocker", "libero" })]
    public async Task Enum_values_are_what_the_api_serializes(Type enumType, string[] wire)
    {
        var schema = OpenApiNodes.Schemas(await ContractDocument.ParsedAsync())[enumType.Name]!;
        var options = ContractDocument.ApiJsonOptions();

        var serialized = Enum.GetValues(enumType).Cast<object>().Select(value => JsonSerializer.Serialize(value, enumType, options).Trim('"'));

        Assert.Equal("string", (string?)schema["type"]);
        Assert.Equal(serialized, schema["enum"]!.AsArray().Select(value => (string)value!));
        Assert.Equal(wire, serialized);
    }

    /// <summary>A list of enums has no component of its own: every `otherPositions` describes its items inline (E3.17).</summary>
    [Theory]
    [InlineData("MemberResponse")]
    [InlineData("MyProfileResponse")]
    [InlineData("SaveMyProfileRequest")]
    public async Task Position_lists_carry_the_wire_values_of_each_item(string schemaName)
    {
        var schemas = OpenApiNodes.Schemas(await ContractDocument.ParsedAsync());
        var enumType = typeof(Sacou.Modules.Identity.Contracts.PlayingPosition);
        var options = ContractDocument.ApiJsonOptions();

        var items = schemas[schemaName]!["properties"]!["otherPositions"]!["items"]!;

        Assert.Equal("string", (string?)items["type"]);
        Assert.Equal(
            ["setter", "outsideHitter", "opposite", "middleBlocker", "libero"],
            Enum.GetValues(enumType).Cast<object>().Select(value => JsonSerializer.Serialize(value, enumType, options).Trim('"')));
        Assert.Equal(
            ["setter", "outsideHitter", "opposite", "middleBlocker", "libero"],
            items["enum"]!.AsArray().Select(value => (string)value!));
    }

    [Fact]
    public async Task Rule_errors_are_ApiProblem_with_a_required_code()
    {
        var document = await ContractDocument.ParsedAsync();

        var required = OpenApiNodes.Schemas(document)["ApiProblem"]!["required"]!.AsArray().Select(field => (string?)field);
        Assert.Contains("code", required);
        foreach (var (_, path, operation) in OpenApiNodes.Operations(document))
        {
            foreach (var (status, response) in OpenApiNodes.Responses(operation).Where(response => response.Status is "403" or "404" or "409"))
            {
                Assert.True(OpenApiNodes.ProblemReference(response) == OpenApiNodes.ApiProblem, $"{path} {status}");
            }
        }
    }

    [Fact]
    public async Task Every_error_body_is_one_of_the_two_problems()
    {
        var document = await ContractDocument.ParsedAsync();

        var errors = OpenApiNodes.Operations(document)
            .SelectMany(operation => OpenApiNodes.Responses(operation.Node))
            .Where(response => response.Status[0] is '4' or '5' && response.Node["content"] is not null);

        Assert.All(errors, response => Assert.Contains(
            OpenApiNodes.ProblemReference(response.Node), new[] { OpenApiNodes.ApiProblem, OpenApiNodes.ProblemDetails }));
    }

    [Fact]
    public async Task Signed_in_operations_answer_401_and_503_with_retry_after()
    {
        var document = await ContractDocument.ParsedAsync();

        Assert.False(document["paths"]!.AsObject().ContainsKey("/health"));
        Assert.All(OpenApiNodes.Operations(document), operation =>
        {
            Assert.Equal(OpenApiNodes.ProblemDetails, OpenApiNodes.ProblemReference(OpenApiNodes.Response(operation.Node, "401")));
            var unavailable = OpenApiNodes.Response(operation.Node, "503");
            Assert.Equal(OpenApiNodes.ProblemDetails, OpenApiNodes.ProblemReference(unavailable));
            Assert.NotNull(unavailable["headers"]?["Retry-After"]);
        });
    }

    [Fact]
    public async Task Operations_with_a_body_answer_400_and_capped_ones_413()
    {
        var document = await ContractDocument.ParsedAsync();
        await using var factory = new SacouApiFactory();
        var capped = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .Where(endpoint => endpoint.Metadata.GetMetadata<IRequestSizeLimitMetadata>() is not null)
            .Select(endpoint => endpoint.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName)
            .ToHashSet(StringComparer.Ordinal);

        Assert.NotEmpty(capped);
        foreach (var (_, path, operation) in OpenApiNodes.Operations(document))
        {
            var responses = operation["responses"]!.AsObject();
            Assert.True(operation["requestBody"] is null || responses.ContainsKey("400"), $"{path}: body without 400");
            Assert.Equal(capped.Contains((string?)operation["operationId"]), responses.ContainsKey("413"));
        }
    }

    /// <summary>Counted here by reflection over every module in the output, apart from the transformer.</summary>
    [Fact]
    public async Task Error_code_catalog_lists_every_module_error_once_and_sorted()
    {
        var catalog = (await ContractDocument.ParsedAsync())["x-sacou-error-codes"]!.AsArray().Select(code => (string)code!).ToList();

        var declared = Directory.GetFiles(AppContext.BaseDirectory, ModuleAssemblyPattern)
            .Select(Assembly.LoadFrom)
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type => type.Name.EndsWith(ErrorsSuffix, StringComparison.Ordinal))
            .SelectMany(type => type.GetFields(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static))
            .Where(field => field.FieldType == typeof(Error) && field.IsInitOnly)
            .Select(field => ((Error)field.GetValue(null)!).Code);

        Assert.Equal(declared.Distinct().Order(StringComparer.Ordinal), catalog);
        Assert.Equal(catalog.Distinct().Order(StringComparer.Ordinal), catalog);
        Assert.Contains("groups.last-admin", catalog);
        Assert.Contains("identity.user-not-registered", catalog);
        Assert.Contains("identity.subject-invalid", catalog);
    }

    /// <summary>
    /// C9: each DTO, serialized with the API's own options, has exactly the properties of its schema. Catches a
    /// property the schema generator did not see (a converter, an ignore attribute, a custom name).
    /// </summary>
    [Fact]
    public async Task Each_dto_serializes_to_exactly_its_schema()
    {
        var schemas = OpenApiNodes.Schemas(await ContractDocument.ParsedAsync());
        var options = ContractDocument.ApiJsonOptions();
        var dtos = Directory.GetFiles(AppContext.BaseDirectory, ModuleAssemblyPattern)
            .Select(Assembly.LoadFrom)
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type => schemas.ContainsKey(type.Name) && type.IsClass)
            .ToList();

        Assert.True(dtos.Count >= 15, $"only {dtos.Count} DTOs matched a schema");
        Assert.All(dtos, type =>
        {
            var serialized = JsonSerializer.SerializeToNode(RuntimeHelpers.GetUninitializedObject(type), type, options)!.AsObject();
            var described = schemas[type.Name]!["properties"]!.AsObject();
            Assert.Equal(described.Select(property => property.Key).Order(StringComparer.Ordinal), serialized.Select(property => property.Key).Order(StringComparer.Ordinal));
        });
    }

    [Fact]
    public async Task Request_schemas_refuse_unknown_fields()
    {
        var document = await ContractDocument.ParsedAsync();
        var schemas = OpenApiNodes.Schemas(document);

        var requests = OpenApiNodes.Operations(document)
            .Select(operation => (string?)operation.Node["requestBody"]?["content"]?["application/json"]?["schema"]?["$ref"])
            .OfType<string>()
            .ToList();

        Assert.NotEmpty(requests);
        Assert.All(requests, reference => Assert.False((bool?)schemas[OpenApiNodes.SchemaId(reference)]!["additionalProperties"] ?? true, reference));
    }
    /// <summary>The group prefix is read by the access filter, not bound by a handler: it is still a path parameter.</summary>
    [Fact]
    public async Task Every_route_segment_is_a_required_path_parameter()
    {
        var document = await ContractDocument.ParsedAsync();

        foreach (var (method, path, operation) in OpenApiNodes.Operations(document))
        {
            var segments = RouteSegments().Matches(path).Select(match => match.Groups[1].Value).ToList();
            var declared = (operation["parameters"]?.AsArray() ?? [])
                .Select(parameter => parameter!.AsObject())
                .Where(parameter => (string?)parameter["in"] == "path" && (bool?)parameter["required"] == true)
                .Select(parameter => (string?)parameter["name"])
                .ToList();
            Assert.True(segments.SequenceEqual(segments.Intersect(declared)), $"{method} {path}");
        }

        var groupId = OpenApiNodes.Operations(document).First(operation => operation.Path == "/v1/groups/{groupId}").Node["parameters"]![0]!;
        Assert.Equal("uuid", (string?)groupId["schema"]?["format"]);
    }

    [GeneratedRegex(@"\{([A-Za-z0-9_]+)\}", RegexOptions.CultureInvariant)]
    private static partial Regex RouteSegments();
}
