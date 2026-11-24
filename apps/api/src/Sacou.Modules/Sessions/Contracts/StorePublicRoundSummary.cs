using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RoundLinks;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>The round by its code, the group's name and settings through the Groups contracts, and nothing written.</summary>
internal sealed class StorePublicRoundSummary(
    RoundLinkReader reader,
    IGroupDirectory directory,
    IGroupSettingsReader settings,
    IRoundListNames listNames,
    IGroupMembership membership,
    TimeProvider time) : IPublicRoundSummary
{
    public async Task<PublicRoundSummary?> FindByCodeAsync(string? code, CancellationToken cancellationToken)
    {
        var found = await reader.FindAsync(code, cancellationToken).ConfigureAwait(false);
        if (found.IsFailure)
        {
            return null;
        }

        var round = found.Value;
        var name = await directory.FindNameAsync(round.GroupId.Value, cancellationToken).ConfigureAwait(false);
        var snapshot = await settings.GetAsync(round.GroupId.Value, cancellationToken).ConfigureAwait(false);
        if (name is null || snapshot is null)
        {
            return null;
        }

        var resolved = settings.ResolveRound(snapshot, round.SettingsLayerJson);
        if (resolved.IsFailure)
        {
            throw new InvalidOperationException("A stored round layer is invalid.");
        }

        Guid[] occupants = [.. round.Occupants.Select(attendance => attendance.Member.Value)];
        var names = await listNames.FindAsync(round.GroupId.Value, occupants, cancellationToken).ConfigureAwait(false);
        var members = await membership.ListActiveAsync(round.GroupId.Value, cancellationToken).ConfigureAwait(false);
        return ToSummary(round, name, resolved.Value, time.GetUtcNow(), names, RoundGroupState.HasRegular(members));
    }

    /// <summary>
    /// <paramref name="hasActiveRegular"/> says whether the group has an active mensalista: without one the avulsos'
    /// window does not hold, here as in the signed-in read (ADR 0079, P3).
    /// </summary>
    internal static PublicRoundSummary ToSummary(
        Round round,
        string groupName,
        RoundSettings resolved,
        DateTimeOffset now,
        IReadOnlyDictionary<Guid, ListName> names,
        bool hasActiveRegular = true)
    {
        var rules = RoundGroupState.ForGroup(resolved.Attendance, hasActiveRegular);
        return new PublicRoundSummary(
            groupName,
            RoundFormat.Date(round.Slot.Date),
            RoundFormat.Time(round.Slot.Time),
            round.Slot.TimeZoneId,
            round.Slot.StartsAt,
            round.Venue.Value,
            StateOf(round, rules, now),
            rules.CapacityLimited ? rules.Capacity : null,
            round.SpotsHeld,
            round.Waitlist.Length,
            rules.WaitlistEnabled,
            resolved.Draw.PlayersPerTeam,
            resolved.Format.ScoringEnabled ? resolved.Format.PointsPerSet : null,
            resolved.Format.QueueEnabled,
            [.. round.Occupants.Select(attendance => EntryOf(names.GetValueOrDefault(attendance.Member.Value)))],
            rules.DropInWindowEnabled ? round.Slot.DropInOpensAt(rules.DropInOpensHoursBefore) : null);
    }

    /// <summary>A line without a name when the member left the group after answering: the spot still counts.</summary>
    private static PublicListEntry EntryOf(ListName? name) => new(name?.Nickname, name?.Regular ?? false);

    internal static PublicRoundState StateOf(Round round, AttendanceSettings rules, DateTimeOffset now)
    {
        if (round.IsCanceled)
        {
            return PublicRoundState.Canceled;
        }

        if (round.ClosedAt is not null)
        {
            return PublicRoundState.Ended;
        }

        if (!round.IsOpenForLinkAt(now))
        {
            return PublicRoundState.Started;
        }

        return rules.HasRoom(round.SpotsHeld) ? PublicRoundState.Open : PublicRoundState.Full;
    }
}
