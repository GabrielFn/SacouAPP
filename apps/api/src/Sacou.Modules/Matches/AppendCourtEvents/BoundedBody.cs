using Microsoft.AspNetCore.Http;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>
/// The raw body in a buffer that never grows past the ceiling, whatever the host: Kestrel enforces the
/// <c>RequestSizeLimit</c> of the route too, and its refusal while reading is the same null (ADR 0060, D8 step 1).
/// The buffer starts at the declared length (or one chunk) and doubles, so a one-point write stays small.
/// </summary>
internal static class BoundedBody
{
    private const int ChunkBytes = 16 * 1024;
    private const int GrowthFactor = 2;
    private const int OneByteMore = 1;

    /// <summary>The bytes, or null when the body is larger than <paramref name="maxBytes"/>.</summary>
    public static async Task<ReadOnlyMemory<byte>?> ReadAsync(HttpRequest request, int maxBytes, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.ContentLength > maxBytes)
        {
            return null;
        }

        // One byte past the ceiling is enough to know the body is too large.
        var ceiling = maxBytes + OneByteMore;
        var buffer = new byte[Math.Min(ceiling, (int)(request.ContentLength ?? ChunkBytes) + OneByteMore)];
        var total = 0;
        try
        {
            while (true)
            {
                if (total == buffer.Length)
                {
                    if (buffer.Length == ceiling)
                    {
                        return null;
                    }

                    Array.Resize(ref buffer, Math.Min(ceiling, buffer.Length * GrowthFactor));
                }

                var read = await request.Body.ReadAsync(buffer.AsMemory(total), cancellationToken).ConfigureAwait(false);
                if (read == 0)
                {
                    return buffer.AsMemory(0, total);
                }

                total += read;
            }
        }
        catch (BadHttpRequestException exception) when (exception.StatusCode == StatusCodes.Status413PayloadTooLarge)
        {
            return null;
        }
    }
}
