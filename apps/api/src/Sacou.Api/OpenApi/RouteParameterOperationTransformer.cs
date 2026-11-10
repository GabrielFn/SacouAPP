using System.Text.RegularExpressions;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>
/// Every <c>{name}</c> of the route is a required path parameter, also the ones no handler binds: the group
/// prefix <c>/v1/groups/{groupId:guid}</c> is read by the access filter (ADR 0040), so the generator left it out
/// and the app could not fill it in (E4.2, Part 2). A <c>guid</c> constraint is a <c>uuid</c> string.
/// </summary>
internal sealed partial class RouteParameterOperationTransformer : IOpenApiOperationTransformer
{
    private const string GuidConstraint = "guid";
    private const string UuidFormat = "uuid";

    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(operation);
        ArgumentNullException.ThrowIfNull(context);
        var template = context.Description.ActionDescriptor.AttributeRouteInfo?.Template ?? context.Description.RelativePath ?? string.Empty;
        var declared = (operation.Parameters ?? [])
            .Where(parameter => parameter.In == ParameterLocation.Path)
            .Select(parameter => parameter.Name)
            .ToHashSet(StringComparer.Ordinal);
        var missing = RouteSegment().Matches(template)
            .Where(match => !declared.Contains(match.Groups["name"].Value))
            .Select(match => PathParameter(match.Groups["name"].Value, match.Groups["constraint"].Value))
            .ToList();
        if (missing.Count > 0)
        {
            operation.Parameters = [.. missing, .. operation.Parameters ?? []];
        }

        return Task.CompletedTask;
    }

    private static OpenApiParameter PathParameter(string name, string constraint) => new()
    {
        Name = name,
        In = ParameterLocation.Path,
        Required = true,
        Schema = string.Equals(constraint, GuidConstraint, StringComparison.Ordinal)
            ? new OpenApiSchema { Type = JsonSchemaType.String, Format = UuidFormat }
            : new OpenApiSchema { Type = JsonSchemaType.String },
    };

    [GeneratedRegex(@"\{(?<name>[A-Za-z_][A-Za-z0-9_]*)(?::(?<constraint>[A-Za-z]+))?\}", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 1000)]
    private static partial Regex RouteSegment();
}
