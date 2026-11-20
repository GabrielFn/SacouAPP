using System.Net;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;
using N = Sacou.Integration.Tests.Notifications.NotificationCalls;

namespace Sacou.Integration.Tests.Notifications;

/// <summary>
/// I6 and I7 of E3.11, and the review of part 1: the relay survives a crash between the ask and the mark, two relays
/// never take one message, a poison message never blocks the others, and nothing after the commit becomes a 500.
/// </summary>
public sealed class OutboxRelayTests : IAsyncLifetime
{
    /// <summary>The relay's <c>MaxAttempts</c>: a poison message is set aside after this many failures.</summary>
    private const int MaxAttempts = 5;

    /// <summary>Longer than the Notifications' dedupe key may be (200): every ask of it fails, on any API.</summary>
    private const int PoisonKeyLength = 201;

    private const int Phones = 2;
    private const int Seeded = 6;
    private const int Racers = 3;

    private readonly ApiWithDatabase api;

    public OutboxRelayTests(IntegrationDatabase database) => api = new ApiWithDatabase(database) { PushGateway = new RecordingPushGateway() };

    public async ValueTask InitializeAsync() => await api.MigrateAsync();

    public async ValueTask DisposeAsync() => await api.DisposeAsync();

    [Fact]
    public async Task AFailureAfterTheCommit_IsNever500_AndTheRestWaits()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, going, waiting) = await N.RoundWithAWaitlistAsync(world);
        api.BeforePump = () => throw new InvalidOperationException("injected pump failure");
        api.AfterNotificationRequested = _ => throw new InvalidOperationException("injected relay failure");

        var (status, _, body) = await RoundCalls.RespondAsync(world, going.Subject, round, going: false);

        api.BeforePump = null;
        api.AfterNotificationRequested = null;
        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("notGoing", body!["status"]!.GetValue<string>());
        Assert.Equal(1, await N.OutboxOfRoundAsync(api.ConnectionString, round));
        Assert.Equal(1, await N.NotificationsOfMemberAsync(api.ConnectionString, waiting.MemberId));
    }

    [Fact]
    public async Task I6_TheRelayFallingBeforeProcessedAt_RunsAgain_AndMakesNothingNew()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var (round, going, waiting) = await N.RoundWithAWaitlistAsync(world);
        for (var phone = 0; phone < Phones; phone++)
        {
            await N.RegisterAsync(world, waiting.Subject, Guid.NewGuid(), N.Token());
        }

        // Fails right after the Notifications wrote, before the outbox row is marked.
        api.AfterNotificationRequested = request => request.MemberId == waiting.MemberId
            ? throw new InvalidOperationException("injected crash before processed_at")
            : Task.CompletedTask;
        Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, going.Subject, round, going: false)).Status);
        api.AfterNotificationRequested = null;
        var message = await N.OutboxIdAsync(api.ConnectionString, round, waiting.MemberId);
        Assert.Equal(1, await N.NotificationsOfMemberAsync(api.ConnectionString, waiting.MemberId));

        // The next promoting write drains again; then the mark is lost once more, and the write after that drains it again.
        await PromoteSomeoneElseAsync(world);
        _ = await N.ExecuteAsync(api.ConnectionString, "UPDATE sessions.outbox_messages SET processed_at = NULL WHERE id = @id", ("id", message));
        await PromoteSomeoneElseAsync(world);

        Assert.True((await N.OutboxStateAsync(api.ConnectionString, message)).Processed);
        Assert.Equal(1, await N.NotificationsOfMemberAsync(api.ConnectionString, waiting.MemberId));
        Assert.Equal(Phones, await N.DeliveriesOfMemberAsync(api.ConnectionString, waiting.MemberId));
    }

    [Fact]
    public async Task APoisonMessage_NeverBlocksTheOthers_AndIsSetAsideAfterMaxAttempts()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = Guid.Parse((await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>());
        var poison = await N.InsertOutboxAsync(
            api.ConnectionString, new string('p', PoisonKeyLength), world.GroupId, round, Guid.NewGuid(), DateTimeOffset.UnixEpoch);

        var (first, going, waiting) = await N.RoundWithAWaitlistAsync(world);
        _ = await RoundCalls.RespondAsync(world, going.Subject, first, going: false);
        Assert.Equal(1, await N.NotificationsOfMemberAsync(api.ConnectionString, waiting.MemberId));

        // One attempt per drain: each "não vou" below promotes the other one and drains again.
        var people = new[] { waiting, going };
        for (var drain = 1; drain < MaxAttempts; drain++)
        {
            var leaving = people[(drain - 1) % people.Length];
            var back = people[drain % people.Length];
            _ = await RoundCalls.RespondAsync(world, back.Subject, first, going: true);
            Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, leaving.Subject, first, going: false)).Status);
        }

        Assert.Equal((MaxAttempts, true), await N.OutboxStateAsync(api.ConnectionString, poison));
        Assert.Equal(0, await N.CountAsync(
            api.ConnectionString,
            "SELECT count(*) FROM sessions.outbox_messages WHERE payload->>'roundId' = @round AND processed_at IS NULL",
            ("round", first)));
    }

    [Fact]
    public async Task I7_RelaysAtOnce_NeverTakeOneMessageTwice()
    {
        using var client = api.CreateClient();
        var world = await GroupWorld.CreateAsync(api, client);
        var round = Guid.Parse((await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>());
        var person = await world.AddPersonAsync();
        await N.RegisterAsync(world, person.Subject, Guid.NewGuid(), N.Token());
        var seeded = new List<Guid>();
        for (var index = 0; index < Seeded; index++)
        {
            seeded.Add(await N.InsertOutboxAsync(
                api.ConnectionString, $"test:{Guid.NewGuid():N}", world.GroupId, round, person.MemberId, DateTimeOffset.UtcNow));
        }

        var rounds = new List<(string Round, string Subject)>();
        for (var racer = 0; racer < Racers; racer++)
        {
            var (racing, going, _) = await N.RoundWithAWaitlistAsync(world);
            rounds.Add((racing, going.Subject));
        }

        var statuses = await N.RaceAsync(rounds.Select(entry => (Func<Task<HttpStatusCode>>)(
            async () => (await RoundCalls.RespondAsync(world, entry.Subject, entry.Round, going: false)).Status)));

        Assert.All(statuses, status => Assert.Equal(HttpStatusCode.OK, status));
        foreach (var message in seeded)
        {
            Assert.Equal((1, true), await N.OutboxStateAsync(api.ConnectionString, message));
        }

        Assert.Equal(Seeded, await N.NotificationsOfMemberAsync(api.ConnectionString, person.MemberId));
        Assert.Equal(Seeded, await N.DeliveriesOfMemberAsync(api.ConnectionString, person.MemberId));
    }

    /// <summary>A promotion in a round of its own: a write that drains the outbox.</summary>
    private static async Task PromoteSomeoneElseAsync(GroupWorld world)
    {
        var (round, going, _) = await N.RoundWithAWaitlistAsync(world);
        Assert.Equal(HttpStatusCode.OK, (await RoundCalls.RespondAsync(world, going.Subject, round, going: false)).Status);
    }
}
