using System.Net;
using System.Net.Sockets;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Infrastructure.Expo;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>E1 of E3.11: every line of the table of plan 3.1, from Expo's answer to what the pump does.</summary>
public sealed class ExpoOutcomesTests
{
    private static readonly Guid Delivery = new("00000000-0000-0000-0000-0000000000d1");

    [Theory]
    [InlineData("DeviceNotRegistered", nameof(PushResultKind.DeviceNotRegistered), "DeviceNotRegistered")]
    [InlineData("MessageRateExceeded", nameof(PushResultKind.Retry), "MessageRateExceeded")]
    [InlineData("MessageTooBig", nameof(PushResultKind.Failed), "MessageTooBig")]
    [InlineData("InvalidCredentials", nameof(PushResultKind.Failed), "InvalidCredentials")]
    [InlineData("MismatchSenderId", nameof(PushResultKind.Failed), "MismatchSenderId")]
    [InlineData("SomethingNew", nameof(PushResultKind.Failed), "SomethingNew")]
    [InlineData(null, nameof(PushResultKind.Failed), ExpoOutcomes.UnknownError)]
    [InlineData("has space \"ExponentPushToken[x]\"", nameof(PushResultKind.Failed), ExpoOutcomes.UnknownError)]
    public void ErrorTicket_ByItsCode(string? code, string kind, string expected)
    {
        var result = ExpoOutcomes.Classify(Delivery, new ExpoTicket("error", null, new ExpoDetails(code)));

        Assert.Equal((Enum.Parse<PushResultKind>(kind), expected), (result.Kind, result.Code));
        Assert.Null(result.TicketId);
    }

    [Fact]
    public void OkTicket_IsAccepted_WithItsId()
    {
        var result = ExpoOutcomes.Classify(Delivery, new ExpoTicket("ok", "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", null));

        Assert.Equal((PushResultKind.Accepted, "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"), (result.Kind, result.TicketId));
    }

    [Theory]
    [InlineData("ok", null)]
    [InlineData("ok", "")]
    [InlineData("ok", "id with space")]
    [InlineData("weird", "abc")]
    public void TicketWeCannotRead_IsAmbiguous_NeverSentAgain(string status, string? id) =>
        Assert.Equal(PushResultKind.Ambiguous, ExpoOutcomes.Classify(Delivery, new ExpoTicket(status, id, null)).Kind);

    [Fact]
    public void MissingTicket_IsAmbiguous() => Assert.Equal(PushResultKind.Ambiguous, ExpoOutcomes.Classify(Delivery, null).Kind);

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests, nameof(PushResultKind.Retry))]
    [InlineData(HttpStatusCode.InternalServerError, nameof(PushResultKind.Retry))]
    [InlineData(HttpStatusCode.BadGateway, nameof(PushResultKind.Retry))]
    [InlineData(HttpStatusCode.ServiceUnavailable, nameof(PushResultKind.Retry))]
    [InlineData(HttpStatusCode.BadRequest, nameof(PushResultKind.Failed))]
    [InlineData(HttpStatusCode.Unauthorized, nameof(PushResultKind.Failed))]
    [InlineData(HttpStatusCode.Forbidden, nameof(PushResultKind.Failed))]
    public void StatusWithoutTickets_RetriesOnlyWhatMayPass(HttpStatusCode status, string kind)
    {
        var result = ExpoOutcomes.ClassifyStatus(Delivery, status);

        Assert.Equal(Enum.Parse<PushResultKind>(kind), result.Kind);
        Assert.Equal($"http-{(int)status}", result.Code);
    }

    [Fact]
    public void ConnectionNeverMade_IsTriedAgain() =>
        Assert.Equal(
            PushResultKind.Retry,
            ExpoOutcomes.ClassifyFailure(Delivery, new HttpRequestException(HttpRequestError.ConnectionError, "refused", new SocketException())).Kind);

    [Fact]
    public void TimeoutOrCutConnection_IsAmbiguous()
    {
        Assert.Equal(PushResultKind.Ambiguous, ExpoOutcomes.ClassifyFailure(Delivery, new TaskCanceledException()).Kind);
        Assert.Equal(PushResultKind.Ambiguous, ExpoOutcomes.ClassifyFailure(Delivery, new HttpRequestException(HttpRequestError.ResponseEnded, "cut")).Kind);
        Assert.Equal(PushResultKind.Ambiguous, ExpoOutcomes.ClassifyFailure(Delivery, new IOException("reset")).Kind);
    }

    [Theory]
    [InlineData("ok", null, nameof(PushReceiptKind.Delivered))]
    [InlineData("error", "DeviceNotRegistered", nameof(PushReceiptKind.DeviceNotRegistered))]
    [InlineData("error", "MessageRateExceeded", nameof(PushReceiptKind.Failed))]
    [InlineData("error", "InvalidCredentials", nameof(PushReceiptKind.Failed))]
    [InlineData("error", "MessageTooBig", nameof(PushReceiptKind.Failed))]
    public void Receipt_ByItsStatus(string status, string? code, string kind) =>
        Assert.Equal(Enum.Parse<PushReceiptKind>(kind), ExpoOutcomes.ClassifyReceipt("t", new ExpoReceipt(status, code is null ? null : new ExpoDetails(code)))!.Kind);

    [Fact]
    public void ReceiptOutOfShape_IsLeftForLater()
    {
        Assert.Null(ExpoOutcomes.ClassifyReceipt("t", null));
        Assert.Null(ExpoOutcomes.ClassifyReceipt("t", new ExpoReceipt("pending", null)));
    }
}
