using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Queue;

/// <summary>
/// Who waits for the court, in order: whole teams first, then single players by arrival. A member is
/// in it once, and never in a team on the court (ADR 0029). Properties in the key order of the events.
/// </summary>
internal sealed record TeamQueue(ImmutableArray<string> Players, ImmutableArray<TeamRoster> Teams)
{
    public static readonly TeamQueue Empty = new([], []);
}

/// <summary>Port of <c>score/queue-rules.ts</c>.</summary>
internal static class QueueRules
{
    public const string QueueChangedEventType = ScoreEventTypes.QueueChanged;

    /// <summary>
    /// Technical limit, not a volleyball rule: four full teams of 24 waiting. It keeps a queue below
    /// 300 values, far from the 4096 of a payload (ADR 0029).
    /// </summary>
    public const int MaxQueueMembers = 96;

    /// <summary>Everyone waiting, teams first and then players, each one once by the parser.</summary>
    public static ImmutableArray<string> QueueMembers(TeamQueue queue) =>
        [.. queue.Teams.SelectMany(team => team.MemberIds), .. queue.Players];

    public static int QueueSize(TeamQueue queue) => QueueMembers(queue).Length;

    /// <summary>
    /// Whether anyone waiting is on the court: the queue is checked against the frozen teams, the
    /// ones of the payload or of the open match, never against the state (ADR 0029).
    /// </summary>
    public static bool IsQueueOverlappingTeams(TeamQueue queue, BySide<TeamRoster> teams) =>
        QueueMembers(queue).Any(memberId =>
            teams.A.MemberIds.Contains(memberId, StringComparer.Ordinal)
            || teams.B.MemberIds.Contains(memberId, StringComparer.Ordinal));
}
