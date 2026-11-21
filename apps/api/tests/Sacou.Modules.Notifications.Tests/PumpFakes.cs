using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Notifications.Application;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Domain;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.Tests;

/// <summary>One delivery of the in-memory store, as its row would be.</summary>
internal sealed class FakeDelivery
{
    public required Guid Id { get; init; }

    public required Guid MemberId { get; init; }

    public required Guid UserId { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public required DateTimeOffset ExpiresAt { get; init; }

    public Guid DeviceId { get; } = Guid.NewGuid();

    public DeliveryState State { get; set; } = DeliveryState.Pending;

    public int Attempts { get; set; }

    public DateTimeOffset NextAttemptAt { get; set; }

    public string? TicketId { get; set; }

    public string? ErrorCode { get; set; }

    public bool DeviceDisabled { get; set; }
}

/// <summary>The deliveries in memory, with the same claims and moves as the SQL of <c>PostgresDeliveryStore</c>.</summary>
internal sealed class InMemoryDeliveryStore : IDeliveryStore
{
    public static readonly Guid Group = Guid.NewGuid();
    public static readonly Guid Round = Guid.NewGuid();

    public List<FakeDelivery> Rows { get; } = [];

    public FakeDelivery Add(DateTimeOffset now, Guid? member = null, Guid? user = null)
    {
        var row = new FakeDelivery
        {
            Id = Guid.NewGuid(),
            MemberId = member ?? Guid.NewGuid(),
            UserId = user ?? Guid.NewGuid(),
            CreatedAt = now,
            ExpiresAt = now.AddDays(2),
            NextAttemptAt = now,
        };
        Rows.Add(row);
        return row;
    }

    public Task RecoverAsync(DateTimeOffset now, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task<IReadOnlyList<ClaimedDelivery>> ClaimAsync(DateTimeOffset now, int take, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var due = Rows.Where(row => row.State == DeliveryState.Pending && row.NextAttemptAt <= now && row.ExpiresAt > now && !row.DeviceDisabled)
            .OrderBy(row => row.NextAttemptAt).Take(take).ToList();
        foreach (var row in due)
        {
            row.State = DeliveryState.Sending;
            row.Attempts++;
        }

        return Task.FromResult<IReadOnlyList<ClaimedDelivery>>([.. due.Select(row => new ClaimedDelivery(
            row.Id, row.Attempts, Guid.NewGuid(), "waitlist_promoted", row.MemberId, Group, Round, row.ExpiresAt, row.DeviceId, row.UserId, "ExponentPushToken[x]"))]);
    }

    public Task RecordAsync(IReadOnlyList<DeliveryOutcome> outcomes, DateTimeOffset now, CancellationToken cancellationToken) =>
        Apply(outcomes, DeliveryState.Sending, keepTicket: false);

    public Task<IReadOnlyList<SentDelivery>> ClaimReceiptsAsync(DateTimeOffset now, int take, CancellationToken cancellationToken)
    {
        var due = Rows.Where(row => row.State == DeliveryState.Sent && row.TicketId is not null && row.NextAttemptAt <= now).Take(take).ToList();
        due.ForEach(row => row.NextAttemptAt = now + NotificationLimits.ReceiptDelay);
        return Task.FromResult<IReadOnlyList<SentDelivery>>([.. due.Select(row => new SentDelivery(row.Id, row.DeviceId, row.TicketId!, row.CreatedAt))]);
    }

    public Task RecordReceiptsAsync(IReadOnlyList<DeliveryOutcome> outcomes, DateTimeOffset now, CancellationToken cancellationToken) =>
        Apply(outcomes, DeliveryState.Sent, keepTicket: true);

    public Task<DateTimeOffset?> NextDueAsync(DateTimeOffset now, CancellationToken cancellationToken) =>
        Task.FromResult(Rows.Where(row => (row.State == DeliveryState.Pending && row.ExpiresAt > now) || row.State == DeliveryState.Sent)
            .Select(row => (DateTimeOffset?)row.NextAttemptAt).Min());

    private Task Apply(IReadOnlyList<DeliveryOutcome> outcomes, DeliveryState from, bool keepTicket)
    {
        foreach (var outcome in outcomes)
        {
            var row = Rows.Single(candidate => candidate.Id == outcome.DeliveryId);
            if (row.State != from)
            {
                continue;
            }

            row.State = outcome.State;
            row.NextAttemptAt = outcome.NextAttemptAt;
            row.TicketId = keepTicket ? row.TicketId : outcome.TicketId;
            row.ErrorCode = outcome.ErrorCode;
            row.DeviceDisabled |= outcome.DisableDevice;
        }

        return Task.CompletedTask;
    }
}

/// <summary>A push service whose answers the test sets one call at a time; it counts each batch.</summary>
internal sealed class ScriptedPushGateway : IPushGateway
{
    public bool IsEnabled { get; init; } = true;

    public List<int> Batches { get; } = [];

    /// <summary>The answer for each message of the next calls; the last one repeats.</summary>
    public Queue<Func<PushMessage, PushResult>> Answers { get; } = new();

    public Func<IReadOnlyList<string>, IReadOnlyList<PushReceipt>> Receipts { get; set; } = _ => [];

    public Action? DuringSend { get; set; }

    public Task<IReadOnlyList<PushResult>> SendAsync(IReadOnlyList<PushMessage> messages, CancellationToken cancellationToken)
    {
        Batches.Add(messages.Count);
        DuringSend?.Invoke();
        var answer = Answers.Count > 1 ? Answers.Dequeue() : Answers.Count == 1 ? Answers.Peek() : Accept;
        return Task.FromResult<IReadOnlyList<PushResult>>([.. messages.Select(answer)]);
    }

    public Task<IReadOnlyList<PushReceipt>> GetReceiptsAsync(IReadOnlyList<string> ticketIds, CancellationToken cancellationToken) =>
        Task.FromResult(Receipts(ticketIds));

    public static PushResult Accept(PushMessage message) => new(message.DeliveryId, PushResultKind.Accepted, TicketId: "ticket-" + message.DeliveryId.ToString("N"));

    public static PushResult RateLimited(PushMessage message) => new(message.DeliveryId, PushResultKind.Retry, Code: "http-429");
}

/// <summary>Records each due time asked.</summary>
internal sealed class RecordingScheduler : INotificationScheduler
{
    public List<DateTimeOffset> Asked { get; } = [];

    public Task ScheduleAsync(DateTimeOffset dueAt, CancellationToken cancellationToken)
    {
        Asked.Add(dueAt);
        return Task.CompletedTask;
    }
}

/// <summary>Every member active, with the account the test says (by default the one of its delivery).</summary>
internal sealed class FakeMemberAccounts(InMemoryDeliveryStore store) : IMemberAccounts
{
    public Dictionary<Guid, Guid?> Overrides { get; } = [];

    public Task<Guid?> FindUserOfActiveMemberAsync(Guid memberId, CancellationToken cancellationToken) =>
        Task.FromResult(Overrides.TryGetValue(memberId, out var user) ? user : store.Rows.First(row => row.MemberId == memberId).UserId);
}

internal sealed class FakeGroupDirectory : IGroupDirectory
{
    public Task<string?> FindNameAsync(Guid groupId, CancellationToken cancellationToken) => Task.FromResult<string?>("Areia");
}

internal sealed class FakeNotificationRounds : INotificationRounds
{
    public Task<IReadOnlyList<NotificationRound>> FindAsync(IReadOnlyCollection<NotificationRoundKey> rounds, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<NotificationRound>>(
            [.. rounds.Select(key => new NotificationRound(key.GroupId, key.RoundId, new DateOnly(2026, 11, 21), new TimeOnly(8, 0), "Posto 6"))]);
}
