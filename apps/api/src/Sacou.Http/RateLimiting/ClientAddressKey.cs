using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace Sacou.Http.RateLimiting;

/// <summary>
/// The partition of an anonymous visitor of the round page (ADR 0070, D6): the SHA-256, in hex, of the client's address.
/// On Cloud Run the Google front end appends the address it saw as the <b>last</b> item of <c>X-Forwarded-For</c>
/// (ADR 0068, D9), so only that item counts: whatever the client wrote before it is ignored, and a forged header with
/// fifty items is still one partition. Without the header (a developer machine), the connection's address. Lives only
/// in the limiter's memory; never the raw address in a log, a metric or an answer.
/// </summary>
public static class ClientAddressKey
{
    public const string ForwardedFor = "X-Forwarded-For";

    /// <summary>The one partition of a request whose address cannot be read.</summary>
    public const string Unknown = "unknown";

    public static string Of(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var address = LastForwarded(context.Request.Headers[ForwardedFor]) ?? context.Connection.RemoteIpAddress;
        return address is null ? Unknown : Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(address.ToString())));
    }

    /// <summary>The last item of the last header line; null when it is absent or not an address.</summary>
    internal static IPAddress? LastForwarded(IReadOnlyList<string?> lines)
    {
        var last = lines.Count == 0 ? null : lines[^1];
        if (string.IsNullOrWhiteSpace(last))
        {
            return null;
        }

        var item = last[(last.LastIndexOf(',') + 1)..].Trim();
        return IPAddress.TryParse(item, out var address) ? address : null;
    }
}
