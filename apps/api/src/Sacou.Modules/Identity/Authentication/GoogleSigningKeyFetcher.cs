using System.Collections.Frozen;
using System.Net;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace Sacou.Modules.Identity.Authentication;

internal sealed record FetchedSigningKeys(FrozenDictionary<string, X509SecurityKey> Keys, TimeSpan? MaxAge);

/// <summary>
/// One GET to the URL the Firebase documentation names, and nowhere else: no redirect, 5 s, 64 KB
/// at most. A failure returns null and logs only its category (ADR 0036).
/// </summary>
internal sealed partial class GoogleSigningKeyFetcher(
    IHttpClientFactory clients,
    ILogger<GoogleSigningKeyFetcher> logger)
{
    public static readonly Uri KeysUri =
        new("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");

    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    public const int MaxDocumentBytes = 64 * 1024;

    /// <summary>The handler behind the named client. A redirect would leave the fixed URL.</summary>
    public static SocketsHttpHandler CreatePrimaryHandler() => new() { AllowAutoRedirect = false };

    /// <summary>Never takes the caller's token: one request cancelled must not cancel the refresh others wait for.</summary>
    public async Task<FetchedSigningKeys?> FetchAsync()
    {
        try
        {
            using var client = clients.CreateClient(IdentityModule.SigningKeysHttpClientName);
            using var request = new HttpRequestMessage(HttpMethod.Get, KeysUri);
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false);
            return await ReadAsync(response).ConfigureAwait(false);
        }
        catch (HttpRequestException)
        {
            LogFetchFailed(logger, "network");
            return null;
        }
        catch (OperationCanceledException)
        {
            LogFetchFailed(logger, "timeout");
            return null;
        }
    }

    private async Task<FetchedSigningKeys?> ReadAsync(HttpResponseMessage response)
    {
        if (response.StatusCode != HttpStatusCode.OK)
        {
            LogUnexpectedStatus(logger, (int)response.StatusCode);
            return null;
        }

        var body = await ReadLimitedAsync(response.Content).ConfigureAwait(false);
        var keys = body is null ? null : SigningKeyDocumentParser.Parse(body);
        if (keys is null)
        {
            LogFetchFailed(logger, body is null ? "too-large" : "invalid-document");
            return null;
        }

        return new FetchedSigningKeys(keys, response.Headers.CacheControl?.MaxAge);
    }

    private static async Task<byte[]?> ReadLimitedAsync(HttpContent content)
    {
        if (content.Headers.ContentLength > MaxDocumentBytes)
        {
            return null;
        }

        var buffer = new byte[MaxDocumentBytes + 1];
        var stream = await content.ReadAsStreamAsync().ConfigureAwait(false);
        await using (stream.ConfigureAwait(false))
        {
            var read = await stream.ReadAtLeastAsync(buffer, buffer.Length, throwOnEndOfStream: false).ConfigureAwait(false);
            return read > MaxDocumentBytes ? null : buffer[..read];
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Fetching the ID token signing keys failed: {Category}.")]
    private static partial void LogFetchFailed(ILogger logger, string category);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Fetching the ID token signing keys returned HTTP {StatusCode}.")]
    private static partial void LogUnexpectedStatus(ILogger logger, int statusCode);
}
