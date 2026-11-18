using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>
/// The answers that come from the pipeline, before any handler, so no endpoint declares them: 401, 429
/// (<c>api.rate-limited</c>, ADR 0062) and 503 (both with <c>Retry-After</c>, ADR 0036) on every signed-in route, 400 on every route with a body (a body that
/// does not bind has no code, so this 400 is a <c>ProblemDetails</c> whose <c>code</c> may be missing), and
/// 413 on every route with a body limit (Kestrel answers it).
/// </summary>
internal sealed class CommonResponsesOperationTransformer : IOpenApiOperationTransformer
{
    public const string RetryAfterHeader = "Retry-After";

    private const string Int32Format = "int32";

    private static readonly string Unauthorized = Status(StatusCodes.Status401Unauthorized);
    private static readonly string TooManyRequests = Status(StatusCodes.Status429TooManyRequests);
    private static readonly string Unavailable = Status(StatusCodes.Status503ServiceUnavailable);
    private static readonly string BadRequest = Status(StatusCodes.Status400BadRequest);
    private static readonly string TooLarge = Status(StatusCodes.Status413PayloadTooLarge);

    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(operation);
        ArgumentNullException.ThrowIfNull(context);
        var description = context.Description;
        var metadata = description.ActionDescriptor.EndpointMetadata;
        var responses = operation.Responses ??= [];
        if (!metadata.OfType<IAllowAnonymous>().Any())
        {
            responses[Unauthorized] = Pipeline("Not signed in, or the ID token was refused.", context.Document);
            responses[TooManyRequests] = WithRetryAfter(Pipeline("Too many requests from this user (code api.rate-limited): try again after Retry-After seconds.", context.Document));
            responses[Unavailable] = WithRetryAfter(Pipeline("The ID token cannot be checked now: try again after Retry-After seconds.", context.Document));
        }

        if (description.ParameterDescriptions.Any(parameter => parameter.Source == BindingSource.Body))
        {
            responses[BadRequest] = Pipeline("A body that does not bind (no code), or a rule refusal (with code).", context.Document);
        }

        if (metadata.OfType<IRequestSizeLimitMetadata>().Any())
        {
            responses[TooLarge] = new OpenApiResponse { Description = "The body is over the route's limit." };
        }

        return Task.CompletedTask;
    }

    private static OpenApiResponse Pipeline(string text, OpenApiDocument? document) => new()
    {
        Description = text,
        Content = new Dictionary<string, OpenApiMediaType>(StringComparer.Ordinal)
        {
            [ProblemSchemas.ContentType] = ProblemSchemas.Body(ProblemSchemas.ProblemDetailsId, document),
        },
    };

    private static OpenApiResponse WithRetryAfter(OpenApiResponse response)
    {
        response.Headers = new Dictionary<string, IOpenApiHeader>(StringComparer.Ordinal)
        {
            [RetryAfterHeader] = new OpenApiHeader
            {
                Description = "Seconds to wait before trying again.",
                Required = true,
                Schema = new OpenApiSchema { Type = JsonSchemaType.Integer, Format = Int32Format },
            },
        };
        return response;
    }

    private static string Status(int code) => code.ToString(CultureInfo.InvariantCulture);
}
