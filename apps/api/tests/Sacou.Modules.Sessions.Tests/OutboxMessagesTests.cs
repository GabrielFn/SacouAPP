using System.Text.Json.Nodes;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure.Outbox;
using Sacou.Shared.Members;
using Xunit;

namespace Sacou.Modules.Sessions.Tests;

/// <summary>The outbox message of a promotion: a closed payload of ids and numbers, and a key that tells a repeat from a comeback.</summary>
public sealed class OutboxMessagesTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 20, 12, 0, 0, TimeSpan.Zero);
    private static readonly RoundId Round = new(new Guid("00000000-0000-0000-0000-0000000000aa"));
    private static readonly MemberId Member = new(new Guid("00000000-0000-0000-0000-0000000000bb"));

    [Fact]
    public void DedupeKey_HasRoundMemberAndSequence() =>
        Assert.Equal(
            "sessions.waitlist-promoted:00000000-0000-0000-0000-0000000000aa:00000000-0000-0000-0000-0000000000bb:7",
            OutboxMessages.DedupeKey(new WaitlistPromoted(Round, Member, 7, Now)));

    [Fact]
    public void DedupeKey_OfAComeback_IsAnother() =>
        Assert.NotEqual(
            OutboxMessages.DedupeKey(new WaitlistPromoted(Round, Member, 3, Now)),
            OutboxMessages.DedupeKey(new WaitlistPromoted(Round, Member, 9, Now.AddHours(1))));

    [Fact]
    public void Payload_HasExactlyTheFiveFields()
    {
        var payload = new OutboxPayload(Round.Value, Guid.NewGuid(), Member.Value, 4, Now);

        var fields = JsonNode.Parse(payload.ToJson())!.AsObject().Select(pair => pair.Key);

        Assert.Equal(["roundId", "groupId", "memberId", "sequence", "startsAt"], fields);
        Assert.Equal(payload, OutboxPayload.Read(payload.ToJson()));
    }

    [Fact]
    public void Payload_WithAnotherField_IsRefused()
    {
        var json = JsonNode.Parse(new OutboxPayload(Round.Value, Guid.NewGuid(), Member.Value, 4, Now).ToJson())!.AsObject();
        json["venue"] = "Posto 6";

        Assert.Null(OutboxPayload.Read(json.ToJsonString()));
    }

    [Theory]
    [InlineData("roundId")]
    [InlineData("groupId")]
    [InlineData("memberId")]
    [InlineData("sequence")]
    [InlineData("startsAt")]
    public void Payload_WithoutAField_IsRefused(string field)
    {
        var json = JsonNode.Parse(new OutboxPayload(Round.Value, Guid.NewGuid(), Member.Value, 4, Now).ToJson())!.AsObject();
        _ = json.Remove(field);

        Assert.Null(OutboxPayload.Read(json.ToJsonString()));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not json")]
    [InlineData("[]")]
    public void Payload_OutOfShape_IsRefused(string json) => Assert.Null(OutboxPayload.Read(json));
}
