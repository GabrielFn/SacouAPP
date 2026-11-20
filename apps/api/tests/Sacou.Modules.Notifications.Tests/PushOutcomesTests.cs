using System.Text;
using System.Text.Json;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;
using Sacou.Modules.Notifications.ListNotifications;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>What each answer of the push service does to a delivery, the shape of a push, and the page cursor.</summary>
public sealed class PushOutcomesTests
{
    private const int MaxPushBytes = 4096;
    private static readonly DateTimeOffset Now = new(2026, 11, 20, 12, 0, 0, TimeSpan.Zero);
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Fact]
    public void Accepted_IsSent_WithItsTicket()
    {
        var outcome = PushOutcomes.Of(Claimed(), new PushResult(Claimed().DeliveryId, PushResultKind.Accepted, TicketId: "ticket-1"), Now);

        Assert.Equal(DeliveryState.Sent, outcome.State);
        Assert.Equal("ticket-1", outcome.TicketId);
        Assert.False(outcome.DisableDevice);
    }

    [Fact]
    public void DeviceNotRegistered_Fails_AndTurnsThePhoneOff()
    {
        var outcome = PushOutcomes.Of(Claimed(), Result(PushResultKind.DeviceNotRegistered, "DeviceNotRegistered"), Now);

        Assert.Equal(DeliveryState.Failed, outcome.State);
        Assert.True(outcome.DisableDevice);
    }

    [Fact]
    public void Retry_GoesBackToTheLine_AfterItsDelay()
    {
        var outcome = PushOutcomes.Of(Claimed(attempts: 1), Result(PushResultKind.Retry, "MessageRateExceeded"), Now);

        Assert.Equal(DeliveryState.Pending, outcome.State);
        Assert.Equal(Now.AddSeconds(30), outcome.NextAttemptAt);
    }

    [Fact]
    public void Retry_OnTheLastTry_Fails() =>
        Assert.Equal(DeliveryState.Failed, PushOutcomes.Of(Claimed(attempts: DeliveryRules.MaxAttempts), Result(PushResultKind.Retry), Now).State);

    [Fact]
    public void Failed_IsFailed_NeverRetried() =>
        Assert.Equal(DeliveryState.Failed, PushOutcomes.Of(Claimed(), Result(PushResultKind.Failed, "MessageTooBig"), Now).State);

    [Fact]
    public void Ambiguous_IsUnknown_NeverRetried() =>
        Assert.Equal(DeliveryState.Unknown, PushOutcomes.Of(Claimed(), Result(PushResultKind.Ambiguous, "timeout"), Now).State);

    [Fact]
    public void NoAnswer_IsUnknown_NeverSentAgain()
    {
        var outcome = Assert.Single(PushOutcomes.Of([Claimed()], [], Now));

        Assert.Equal(DeliveryState.Unknown, outcome.State);
        Assert.Equal(PushOutcomes.NoAnswer, outcome.ErrorCode);
    }

    [Fact]
    public void Push_HasOnlyTheKindAndThreeIdsInData_AndFitsInFourKiB()
    {
        var claimed = Claimed();
        var message = PushMessages.Compose(claimed, new string('G', 120), new NotificationRound(claimed.GroupId, claimed.RoundId, new(2026, 11, 21), new(8, 0), "Posto 6"));

        var data = JsonSerializer.SerializeToElement(message.Data, Web);
        Assert.Equal(["kind", "notificationId", "groupId", "roundId"], data.EnumerateObject().Select(property => property.Name));
        Assert.Equal("waitlistPromoted", data.GetProperty("kind").GetString());
        Assert.True(Encoding.UTF8.GetByteCount(JsonSerializer.Serialize(message)) < MaxPushBytes);
        Assert.DoesNotContain("Posto", message.Body, StringComparison.Ordinal);
        Assert.Equal(claimed.ExpiresAt, message.Expiration);
        Assert.DoesNotContain(claimed.ExpoToken, message.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void Cursor_RoundTrips()
    {
        var row = new NotificationRow
        {
            Id = Guid.NewGuid(),
            DedupeKey = "k",
            Kind = "waitlist_promoted",
            MemberId = Guid.NewGuid(),
            GroupId = Guid.NewGuid(),
            RoundId = Guid.NewGuid(),
            CreatedAt = Now.AddTicks(10),
            ExpiresAt = Now,
        };

        var after = NotificationCursors.Parse(NotificationCursors.Format(row)).Value.After;

        Assert.Equal(new NotificationCursor(row.CreatedAt, row.Id), after);
        Assert.Null(NotificationCursors.Parse(null).Value.After);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]
    [InlineData("1.2")]
    [InlineData("-1.0123456789abcdef0123456789abcdef")]
    [InlineData("1.0123456789abcdef0123456789abcdef.1")]
    [InlineData("99999999999999999999.0123456789abcdef0123456789abcdef")]
    [InlineData("1.0123456789ABCDEF-0123456789abcdef")]
    public void Cursor_OutOfShape_IsCursorInvalid(string text) => Assert.Equal(NotificationErrors.CursorInvalid, NotificationCursors.Parse(text).Error);

    private static PushResult Result(PushResultKind kind, string? code = null) => new(Claimed().DeliveryId, kind, Code: code);

    private static ClaimedDelivery Claimed(int attempts = 1) => new(
        new Guid("00000000-0000-0000-0000-000000000001"),
        attempts,
        new Guid("00000000-0000-0000-0000-000000000002"),
        "waitlist_promoted",
        new Guid("00000000-0000-0000-0000-000000000003"),
        new Guid("00000000-0000-0000-0000-000000000004"),
        Now.AddDays(1),
        new Guid("00000000-0000-0000-0000-000000000005"),
        "ExponentPushToken[secret-token-value]");
}
