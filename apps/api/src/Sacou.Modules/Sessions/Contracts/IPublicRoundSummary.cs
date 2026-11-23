using System.Collections.Immutable;

namespace Sacou.Modules.Sessions.Contracts;

/// <summary>
/// What the round's public page shows to anyone holding the link, the WhatsApp robot included (E3.12, ADR 0070, D1 and
/// D5): read without a lock and without a repair. The first names of whoever holds a spot and the mensalista mark, as on
/// screen 01 (question 126, option 2, 19/11/2026); never a position, a level, a member id, the group or round ids, or
/// money. The WhatsApp preview (<c>og:*</c>) uses none of the names.
/// </summary>
public interface IPublicRoundSummary
{
    /// <summary>The summary of the round with that code, or null for a malformed code and for one that found no round alike.</summary>
    Task<PublicRoundSummary?> FindByCodeAsync(string? code, CancellationToken cancellationToken);
}

/// <summary>
/// The public line of a round, as "6x6 · 25 pts · quem perde sai" and the counts. <see cref="Capacity"/> is null without a
/// limit, and <see cref="PointsPerSet"/> without the score. The counts are those of the stored lists, as
/// the page reads them without the reconcile of the signed-in read (ADR 0043, D7). <see cref="Going"/> is the list of
/// who holds a spot, by order of arrival, with no id: a member who left the group is still a line without a name.
/// </summary>
public sealed record PublicRoundSummary(
    string GroupName,
    string LocalDate,
    string LocalTime,
    string TimeZone,
    DateTimeOffset StartsAt,
    string Venue,
    PublicRoundState State,
    int? Capacity,
    int GoingCount,
    int WaitlistCount,
    bool WaitlistEnabled,
    int PlayersPerTeam,
    int? PointsPerSet,
    bool LoserLeaves,
    ImmutableArray<PublicListEntry> Going);

/// <summary>One line of the public list: the first name (null without a profile) and whether it is a mensalista.</summary>
public sealed record PublicListEntry(string? Nickname, bool Regular);

/// <summary>What the page says of the round now.</summary>
public enum PublicRoundState
{
    Open,
    Full,
    Started,
    Ended,
    Canceled,
}
