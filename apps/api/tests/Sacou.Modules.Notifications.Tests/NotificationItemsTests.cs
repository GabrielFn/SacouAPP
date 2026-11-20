using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Infrastructure;
using Sacou.Modules.Notifications.ListNotifications;
using Xunit;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>An item of the list: the venue only while the person is still a member of the group (safety review of E3.11).</summary>
public sealed class NotificationItemsTests
{
    private const string Venue = "Posto 6";

    private static readonly DateOnly Saturday = new(2026, 11, 21);

    private static readonly NotificationRow Row = new()
    {
        Id = Guid.NewGuid(),
        DedupeKey = "test:item",
        Kind = "waitlist_promoted",
        MemberId = Guid.NewGuid(),
        GroupId = Guid.NewGuid(),
        RoundId = Guid.NewGuid(),
        CreatedAt = DateTimeOffset.UnixEpoch,
        ExpiresAt = DateTimeOffset.UnixEpoch,
    };

    private static readonly NotificationRound Round = new(Row.GroupId, Row.RoundId, Saturday, new TimeOnly(8, 0), Venue);

    [Fact]
    public void AnActiveMember_SeesTheVenue() =>
        Assert.Equal($"Sáb 8h · {Venue}", NotificationItems.Render(Row, "Areia", Round, stillMember: true).Subtitle);

    [Fact]
    public void AFormerMember_SeesTheDayAndHour_WithoutTheVenue()
    {
        var item = NotificationItems.Render(Row, "Areia", Round, stillMember: false);

        Assert.Equal("Sáb 8h", item.Subtitle);
        Assert.DoesNotContain(Venue, item.Title, StringComparison.Ordinal);
    }
}
