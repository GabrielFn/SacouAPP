using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.RoundLinks;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>The round by its code, the group's name and settings through the Groups contracts, and nothing written.</summary>
internal sealed class StorePublicRoundSummary(
    RoundLinkReader reader, IGroupDirectory directory, IGroupSettingsReader settings, TimeProvider time) : IPublicRoundSummary
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

        return ToSummary(round, name, resolved.Value, time.GetUtcNow());
    }

    private static PublicRoundSummary ToSummary(Round round, string groupName, RoundSettings resolved, DateTimeOffset now)
    {
        var rules = RoundGroupState.ToDomain(resolved.Attendance);
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
            resolved.Draw.PlayersPerTeam);
    }

    private static PublicRoundState StateOf(Round round, AttendanceSettings rules, DateTimeOffset now)
    {
        if (round.IsCanceled)
        {
            return PublicRoundState.Canceled;
        }

        if (!round.IsOpenForLinkAt(now))
        {
            return PublicRoundState.Started;
        }

        return rules.HasRoom(round.SpotsHeld) ? PublicRoundState.Open : PublicRoundState.Full;
    }
}
