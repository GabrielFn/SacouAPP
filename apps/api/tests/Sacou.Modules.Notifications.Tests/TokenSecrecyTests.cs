using System.Text.Json;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Infrastructure;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>E3.11 part 1, L1: no value that holds the push token prints it, so no log line or exception can leak it.</summary>
public sealed class TokenSecrecyTests
{
    private const string Secret = "ExponentPushToken[SECRETSECRETSECRET]";

    [Fact]
    public void ClaimedDelivery_ToString_NeverPrintsTheToken()
    {
        var claimed = new ClaimedDelivery(
            Guid.NewGuid(), 1, Guid.NewGuid(), "waitlistPromoted", Guid.NewGuid(), Guid.NewGuid(), DateTimeOffset.UnixEpoch, Guid.NewGuid(), Secret);

        Assert.DoesNotContain("SECRET", claimed.ToString(), StringComparison.Ordinal);
        Assert.DoesNotContain("SECRET", $"{claimed}", StringComparison.Ordinal);
    }

    [Fact]
    public void PushMessage_ToString_NeverPrintsTheTokenNorTheText()
    {
        var message = new PushMessage(
            Guid.NewGuid(), Secret, "t", "Entrou no Areia", new PushData("waitlistPromoted", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()), DateTimeOffset.UnixEpoch);

        Assert.DoesNotContain("SECRET", message.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void PushData_HasTheKindAndThreeIdsOnly()
    {
        var json = JsonSerializer.Serialize(new PushData("waitlistPromoted", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()));
        using var document = JsonDocument.Parse(json);

        Assert.Equal(4, document.RootElement.EnumerateObject().Count());
    }

    [Fact]
    public void Compose_UsesGroupAndLocalTime_NeverTheVenue()
    {
        var delivery = new ClaimedDelivery(
            Guid.NewGuid(), 1, Guid.NewGuid(), "waitlistPromoted", Guid.NewGuid(), Guid.NewGuid(), DateTimeOffset.UnixEpoch, Guid.NewGuid(), Secret);
        var round = new NotificationRound(delivery.GroupId, delivery.RoundId, new DateOnly(2026, 11, 21), new TimeOnly(8, 0), "Posto 6");

        var message = PushMessages.Compose(delivery, "Areia", round);

        Assert.Equal("Entrou no Areia · sáb 8h", message.Body);
        Assert.DoesNotContain("Posto", message.Title + message.Body + JsonSerializer.Serialize(message.Data), StringComparison.Ordinal);
    }
}
