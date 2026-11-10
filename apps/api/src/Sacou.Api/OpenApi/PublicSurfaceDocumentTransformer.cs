using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Sacou.Api.OpenApi;

/// <summary>
/// What the document says about where it came from: nothing. No <c>servers</c> (the generator writes the URL
/// of the machine that served it), a fixed title, and no tags (they repeat C# class names and change nothing
/// in the app's types).
/// </summary>
internal sealed class PublicSurfaceDocumentTransformer : IOpenApiDocumentTransformer
{
    public const string Title = "Sacou API";
    public const string Version = "v1";

    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(document);
        document.Servers = [];
        document.Tags = null;
        document.Info = new OpenApiInfo { Title = Title, Version = Version };
        foreach (var operation in (document.Paths ?? []).Values.SelectMany(path => path.Operations?.Values ?? Enumerable.Empty<OpenApiOperation>()))
        {
            operation.Tags = null;
        }

        return Task.CompletedTask;
    }
}
