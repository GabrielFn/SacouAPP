using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using Sacou.Modules.Notifications.Application;

namespace Sacou.Modules.Notifications.Infrastructure.Expo;

/// <summary>
/// The table of plan 3.1 (E3.11; case E1), as pure functions: what each Expo answer means for a message. Only Expo's
/// error code is kept, and only when it looks like one: its free <c>message</c> may quote the token and is never read.
/// </summary>
internal static partial class ExpoOutcomes
{
    public const string DeviceNotRegistered = "DeviceNotRegistered";
    public const string MessageRateExceeded = "MessageRateExceeded";
    public const string UnknownError = "unknown-error";
    public const string NoTicket = "no-ticket";
    public const string TicketWithoutId = "ticket-without-id";
    public const string Timeout = "timeout";
    public const string ConnectionFailed = "connection-failed";
    public const string ConnectionLost = "connection-lost";
    public const string ResponseUnreadable = "response-unreadable";

    private const string Ok = "ok";
    private const string Error = "error";
    private const int MaxTicketIdLength = 100;

    /// <summary>One ticket of a send answered with 200, by position.</summary>
    public static PushResult Classify(Guid deliveryId, ExpoTicket? ticket) => ticket switch
    {
        null => new PushResult(deliveryId, PushResultKind.Ambiguous, Code: NoTicket),
        { Status: Ok, Id: { Length: > 0 and <= MaxTicketIdLength } id } when SafeId().IsMatch(id) => new PushResult(deliveryId, PushResultKind.Accepted, TicketId: id),
        { Status: Ok } => new PushResult(deliveryId, PushResultKind.Ambiguous, Code: TicketWithoutId),
        { Status: Error } => ByError(deliveryId, ticket.Details?.Error),
        _ => new PushResult(deliveryId, PushResultKind.Ambiguous, Code: ResponseUnreadable),
    };

    /// <summary>A send whose status is not 200: no ticket came, so nothing was taken.</summary>
    public static PushResult ClassifyStatus(Guid deliveryId, HttpStatusCode status) =>
        status == HttpStatusCode.TooManyRequests || (int)status >= (int)HttpStatusCode.InternalServerError
            ? new PushResult(deliveryId, PushResultKind.Retry, Code: StatusCode(status))
            : new PushResult(deliveryId, PushResultKind.Failed, Code: StatusCode(status));

    /// <summary>
    /// A send that threw. Before the connection was made, surely not sent: tried again. After it (a timeout, a cut
    /// connection), maybe sent: ambiguous, never sent again (ADR 0069, D5).
    /// </summary>
    public static PushResult ClassifyFailure(Guid deliveryId, Exception exception) => exception switch
    {
        HttpRequestException { HttpRequestError: HttpRequestError.NameResolutionError or HttpRequestError.ConnectionError or HttpRequestError.SecureConnectionError } =>
            new PushResult(deliveryId, PushResultKind.Retry, Code: ConnectionFailed),
        OperationCanceledException => new PushResult(deliveryId, PushResultKind.Ambiguous, Code: Timeout),
        System.Text.Json.JsonException => new PushResult(deliveryId, PushResultKind.Ambiguous, Code: ResponseUnreadable),
        _ => new PushResult(deliveryId, PushResultKind.Ambiguous, Code: ConnectionLost),
    };

    /// <summary>A receipt: <c>ok</c> is delivered; an error is final. Null for one out of shape (read again later, then unknown).</summary>
    public static PushReceipt? ClassifyReceipt(string ticketId, ExpoReceipt? receipt) => receipt switch
    {
        { Status: Ok } => new PushReceipt(ticketId, PushReceiptKind.Delivered),
        { Status: Error } when receipt.Details?.Error == DeviceNotRegistered => new PushReceipt(ticketId, PushReceiptKind.DeviceNotRegistered, DeviceNotRegistered),
        { Status: Error } => new PushReceipt(ticketId, PushReceiptKind.Failed, SafeCode(receipt.Details?.Error)),
        _ => null,
    };

    /// <summary>Expo's code when it is one (letters, digits, dash, underscore), else <see cref="UnknownError"/>: a log is never injected.</summary>
    public static string SafeCode(string? code) => code is { Length: > 0 and <= MaxTicketIdLength } && SafeId().IsMatch(code) ? code : UnknownError;

    private static PushResult ByError(Guid deliveryId, string? code) => code switch
    {
        DeviceNotRegistered => new PushResult(deliveryId, PushResultKind.DeviceNotRegistered, Code: DeviceNotRegistered),
        MessageRateExceeded => new PushResult(deliveryId, PushResultKind.Retry, Code: MessageRateExceeded),
        _ => new PushResult(deliveryId, PushResultKind.Failed, Code: SafeCode(code)),
    };

    private static string StatusCode(HttpStatusCode status) => string.Create(CultureInfo.InvariantCulture, $"http-{(int)status}");

    [GeneratedRegex("^[A-Za-z0-9_-]+$", RegexOptions.CultureInvariant)]
    private static partial Regex SafeId();
}
