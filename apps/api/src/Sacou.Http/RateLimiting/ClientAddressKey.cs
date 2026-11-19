using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace Sacou.Http.RateLimiting;

/// <summary>
/// The partition of an anonymous visitor of the round page (ADR 0070, D6): the SHA-256, in hex, of the client's address.
/// On Cloud Run the Google front end appends the address it saw as the <b>last</b> item of <c>X-Forwarded-For</c>
/// (ADR 0068, D9), so only that item counts: whatever the client wrote before it is ignored, and a forged header with
/// fifty items is still one partition. Without the header (a developer machine), the connection's address. An IPv6
/// address counts by its /64, the block a home or a phone line gets whole, so cycling the last 64 bits is still one
/// partition; an IPv4-mapped IPv6 address counts as its IPv4. Lives only in the limiter's memory; never the raw address
/// in a log, a metric or an answer.
/// </summary>
public static class ClientAddressKey
{
    public const string ForwardedFor = "X-Forwarded-For";

    /// <summary>The one partition of a request whose address cannot be read.</summary>
    public const string Unknown = "unknown";

    /// <summary>The bytes of an IPv6 network prefix kept for the partition: /64.</summary>
    private const int Ipv6PrefixBytes = 8;

    public static string Of(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var address = LastForwarded(context.Request.Headers[ForwardedFor]) ?? context.Connection.RemoteIpAddress;
        return address is null
            ? Unknown
            : Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(PartitionOf(address).ToString())));
    }

    /// <summary>The IPv4 address as it is; an IPv6 one cut to its /64, without the scope.</summary>
    internal static IPAddress PartitionOf(IPAddress address)
    {
        ArgumentNullException.ThrowIfNull(address);
        if (address.IsIPv4MappedToIPv6)
        {
            return address.MapToIPv4();
        }

        if (address.AddressFamily != AddressFamily.InterNetworkV6)
        {
            return address;
        }

        var bytes = address.GetAddressBytes();
        Array.Clear(bytes, Ipv6PrefixBytes, bytes.Length - Ipv6PrefixBytes);
        return new IPAddress(bytes);
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
