using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Sacou.Modules.Notifications.Infrastructure.CloudTasks;

/// <summary>
/// The access token of the Cloud Run runtime account, from the metadata server (no key file, ADR 0069, D10): cached until
/// a minute before it expires. Only in memory; never logged.
/// </summary>
internal sealed class MetadataAccessToken(IHttpClientFactory clients, TimeProvider time) : IDisposable
{
    public const string HttpClientName = "Sacou.Notifications.Metadata";

    public static readonly Uri TokenUri = new("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token");

    private static readonly TimeSpan RefreshMargin = TimeSpan.FromMinutes(1);

    private readonly SemaphoreSlim refresh = new(1, 1);

    // Replaced whole, never changed in place.
    private CachedToken? current;

    public async Task<string> GetAsync(CancellationToken cancellationToken)
    {
        if (Volatile.Read(ref current) is { } cached && cached.Until > time.GetUtcNow())
        {
            return cached.Value;
        }

        await refresh.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (Volatile.Read(ref current) is { } again && again.Until > time.GetUtcNow())
            {
                return again.Value;
            }

            using var client = clients.CreateClient(HttpClientName);
            using var request = new HttpRequestMessage(HttpMethod.Get, TokenUri);
            request.Headers.Add("Metadata-Flavor", "Google");
            using var response = await client.SendAsync(request, cancellationToken).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            var token = await response.Content.ReadFromJsonAsync<MetadataToken>(cancellationToken).ConfigureAwait(false);
            if (token is not { AccessToken: { Length: > 0 } value, ExpiresIn: > 0 })
            {
                throw new HttpRequestException("The metadata server answered no token.");
            }

            Volatile.Write(ref current, new CachedToken(value, time.GetUtcNow() + TimeSpan.FromSeconds(token.ExpiresIn) - RefreshMargin));
            return value;
        }
        finally
        {
            refresh.Release();
        }
    }

    public void Dispose() => refresh.Dispose();

    private sealed record CachedToken(string Value, DateTimeOffset Until)
    {
        public override string ToString() => "CachedToken";
    }

    private sealed record MetadataToken(
        [property: JsonPropertyName("access_token")] string? AccessToken,
        [property: JsonPropertyName("expires_in")] long ExpiresIn);
}
