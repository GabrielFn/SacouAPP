using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Net.Http.Headers;

namespace Sacou.Http;

/// <summary>Marks a route whose answers no cache along the way may keep, errors included (ADR 0055).</summary>
public sealed class NoStoreMetadata
{
    public static readonly NoStoreMetadata Instance = new();

    private NoStoreMetadata()
    {
    }
}

/// <summary>
/// <c>Cache-Control: no-store</c> from the route's metadata, set when the answer starts, so it also covers the 401 of
/// the authentication, the 403 and 404 of the access filter, a 400 of the body binding and a 500.
/// </summary>
public static class NoStore
{
    public const string Value = "no-store";

    public static TBuilder WithNoStore<TBuilder>(this TBuilder builder)
        where TBuilder : IEndpointConventionBuilder
    {
        ArgumentNullException.ThrowIfNull(builder);
        return builder.WithMetadata(NoStoreMetadata.Instance);
    }

    /// <summary>Goes before the authentication; the routing that WebApplication adds first has already chosen the endpoint.</summary>
    public static IApplicationBuilder UseNoStore(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);
        return app.Use(next => context =>
        {
            if (context.GetEndpoint()?.Metadata.GetMetadata<NoStoreMetadata>() is not null)
            {
                context.Response.OnStarting(() =>
                {
                    context.Response.Headers[HeaderNames.CacheControl] = Value;
                    return Task.CompletedTask;
                });
            }

            return next(context);
        });
    }
}
