using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Notifications.Contracts;
using Sacou.Modules.Notifications.Infrastructure;

namespace Sacou.Modules.Notifications.Application;

/// <summary>The messages of a batch, and the deliveries that cannot become one (their round is gone, or their person left).</summary>
internal sealed record ComposedBatch(IReadOnlyList<PushMessage> Messages, IReadOnlyList<PushResult> Unsendable);

/// <summary>
/// Builds each push from ids (ADR 0069, D6 and D7): the group's current name and the round's local day and hour, rendered
/// now. Never the venue nor a name. <c>data</c> has the kind and three ids only; the expiration is the round's start.
/// Checked again at the send, not only at the fan-out: the member must still be active, and the phone still of that
/// member's account; otherwise the delivery fails unsent (<see cref="RecipientGone"/>).
/// </summary>
internal sealed class PushMessages(IGroupDirectory groups, INotificationRounds rounds, IMemberAccounts accounts)
{
    public const string RoundMissing = "round-missing";

    /// <summary>The member left the group, the account was deleted, or the phone moved to another account.</summary>
    public const string RecipientGone = "recipient-gone";

    /// <summary>The kind the app reads in <c>data</c>, from a closed list.</summary>
    public const string WaitlistPromotedKind = "waitlistPromoted";

    /// <summary>The Android channel the app creates, of high importance (part 3 of E3.11).</summary>
    public const string AndroidChannel = "sacou-espera";

    public async Task<ComposedBatch> ComposeAsync(IReadOnlyList<ClaimedDelivery> batch, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(batch);
        var owners = new Dictionary<Guid, Guid?>();
        foreach (var member in batch.Select(delivery => delivery.MemberId).Distinct())
        {
            owners[member] = await accounts.FindUserOfActiveMemberAsync(member, cancellationToken).ConfigureAwait(false);
        }

        var names = new Dictionary<Guid, string>();
        foreach (var group in batch.Select(delivery => delivery.GroupId).Distinct())
        {
            names[group] = await groups.FindNameAsync(group, cancellationToken).ConfigureAwait(false) ?? NotificationTexts.UnknownGroup;
        }

        var keys = batch.Select(delivery => new NotificationRoundKey(delivery.GroupId, delivery.RoundId)).Distinct().ToList();
        var found = (await rounds.FindAsync(keys, cancellationToken).ConfigureAwait(false))
            .ToDictionary(round => new NotificationRoundKey(round.GroupId, round.RoundId));
        var messages = new List<PushMessage>();
        var unsendable = new List<PushResult>();
        foreach (var delivery in batch)
        {
            if (owners[delivery.MemberId] != delivery.UserId)
            {
                unsendable.Add(new PushResult(delivery.DeliveryId, PushResultKind.Failed, Code: RecipientGone));
            }
            else if (found.TryGetValue(new NotificationRoundKey(delivery.GroupId, delivery.RoundId), out var round))
            {
                messages.Add(Compose(delivery, names[delivery.GroupId], round));
            }
            else
            {
                unsendable.Add(new PushResult(delivery.DeliveryId, PushResultKind.Failed, Code: RoundMissing));
            }
        }

        return new ComposedBatch(messages, unsendable);
    }

    public static PushMessage Compose(ClaimedDelivery delivery, string groupName, NotificationRound round)
    {
        ArgumentNullException.ThrowIfNull(delivery);
        ArgumentNullException.ThrowIfNull(round);
        return new PushMessage(
            delivery.DeliveryId,
            delivery.ExpoToken,
            NotificationTexts.PushTitle,
            NotificationTexts.PushBody(groupName, round.LocalDate, round.LocalTime),
            new PushData(WaitlistPromotedKind, delivery.NotificationId, delivery.GroupId, delivery.RoundId),
            delivery.ExpiresAt);
    }
}
