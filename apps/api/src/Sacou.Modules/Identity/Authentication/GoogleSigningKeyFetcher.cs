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

    /// <summary>The whole fetch, headers and body, must end within this. Tests shorten it.</summary>
    internal TimeSpan FetchTimeout { get; init; } = Timeout;

    /// <summary>
    /// Never takes the caller's token: one request cancelled must not cancel the refresh others wait for.
    /// One deadline covers sending and reading, so a body that never ends cannot hold the refresh lock.
    /// </summary>
    public async Task<FetchedSigningKeys?> FetchAsync()
    {
        using var deadline = new CancellationTokenSource(FetchTimeout);
        try
        {
            using var client = clients.CreateClient(IdentityModule.SigningKeysHttpClientName);
            using var request = new HttpRequestMessage(HttpMethod.Get, KeysUri);
            using var response = await client
                .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, deadline.Token)
                .ConfigureAwait(false);
            return await ReadAsync(response, deadline.Token).ConfigureAwait(false);
        }
        catch (Exception exception) when (exception is HttpRequestException or IOException)
        {
            // HttpIOException (a body cut in the middle) is an IOException. Never log the message.
            LogFetchFailed(logger, "network");
            return null;
        }
        catch (OperationCanceledException)
        {
            LogFetchFailed(logger, "timeout");
            return null;
        }
    }

    private async Task<FetchedSigningKeys?> ReadAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.StatusCode != HttpStatusCode.OK)
        {
            LogUnexpectedStatus(logger, (int)response.StatusCode);
            return null;
        }

        var body = await ReadLimitedAsync(response.Content, cancellationToken).ConfigureAwait(false);
        var keys = body is null ? null : ParseSafely(body);
        if (keys is null)
        {
            LogFetchFailed(logger, body is null ? "too-large" : "invalid-document");
            return null;
        }

        return new FetchedSigningKeys(keys, response.Headers.CacheControl?.MaxAge);
    }

    /// <summary>Defence in depth: whatever the parser throws is a refused document, never a 500.</summary>
    private static FrozenDictionary<string, X509SecurityKey>? ParseSafely(byte[] body)
    {
        try
        {
            return SigningKeyDocumentParser.Parse(body);
        }
        catch (Exception exception) when (exception is not OutOfMemoryException)
        {
            return null;
        }
    }

    private static async Task<byte[]?> ReadLimitedAsync(HttpContent content, CancellationToken cancellationToken)
    {
        if (content.Headers.ContentLength > MaxDocumentBytes)
        {
            return null;
        }

        var buffer = new byte[MaxDocumentBytes + 1];
        var stream = await content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
        await using (stream.ConfigureAwait(false))
        {
            var read = await stream
                .ReadAtLeastAsync(buffer, buffer.Length, throwOnEndOfStream: false, cancellationToken)
                .ConfigureAwait(false);
            return read > MaxDocumentBytes ? null : buffer[..read];
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Fetching the ID token signing keys failed: {Category}.")]
    private static partial void LogFetchFailed(ILogger logger, string category);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Fetching the ID token signing keys returned HTTP {StatusCode}.")]
    private static partial void LogUnexpectedStatus(ILogger logger, int statusCode);
}
