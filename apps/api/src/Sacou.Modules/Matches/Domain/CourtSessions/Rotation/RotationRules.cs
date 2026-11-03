using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Rotation;

/// <summary>
/// Port of the rotation part of <c>score/rotation-rules.ts</c>. Every move goes by position in a
/// table, never by arithmetic on the zone (ADR 0024, ADR 0033 D9).
/// </summary>
internal static class RotationRules
{
    private const int NotFound = -1;
    private const int OneStep = 1;

    /// <summary>
    /// The order a team goes through when it rotates. A literal, not read from the formations
    /// catalog: editing a formation must never change the replay of a recorded match (ADR 0024).
    /// </summary>
    public static readonly ImmutableArray<int> SetterZoneSequence = [1, 6, 5, 4, 3, 2];

    /// <summary>The sequence read backwards: undoing a rotation goes 1, 2, 3, 4, 5, 6 and back to 1.</summary>
    private static readonly ImmutableArray<int> ReversedSetterZoneSequence = [.. SetterZoneSequence.Reverse()];

    /// <summary>Past the end of the sequence there is no next zone, and the rotation starts over.</summary>
    public static int NextSetterZone(int zone) => FollowingIn(SetterZoneSequence, zone);

    /// <summary>The zone a team was in before its last rotation, by the same table read backwards.</summary>
    public static int PreviousSetterZone(int zone) => FollowingIn(ReversedSetterZoneSequence, zone);

    /// <summary>Only the team that was receiving and won the rally rotates and takes the serve.</summary>
    public static bool IsSideOut(TeamSide servingTeam, TeamSide pointWinner) => servingTeam != pointWinner;

    /// <summary>Alternates from who served first in the set: it is not "who lost serves".</summary>
    public static TeamSide GetNextSetFirstServer(TeamSide firstServer) => firstServer.Opponent();

    /// <summary>
    /// The lineup from slot 1 to slot 6. The position in the sequence is how many times the team
    /// rotated from the setter in slot 1, and each rotation brings the next member to slot 1.
    /// </summary>
    public static ImmutableArray<T> GetLineupBySlot<T>(ImmutableArray<T> lineup, int setterZone)
    {
        var rotationCount = RotationCount(setterZone);
        return [.. lineup.Skip(rotationCount), .. lineup.Take(rotationCount)];
    }

    /// <summary>Who is in slot 1. The lineup has six members by the parser, so the entry always exists.</summary>
    public static string GetServingPlayer(ImmutableArray<string> lineup, int setterZone) =>
        lineup[RotationCount(setterZone)];

    /// <summary>Lineup, bench and libero together hold each member of the team exactly once, and nobody else.</summary>
    public static bool IsRosterPartition(
        ImmutableArray<string> lineup,
        ImmutableArray<string> bench,
        TeamLibero? libero,
        TeamRoster roster)
    {
        ImmutableArray<string> allocated = libero is null ? [.. lineup, .. bench] : [.. lineup, .. bench, libero.MemberId];
        return allocated.Length == roster.MemberIds.Length
            && allocated.Distinct(StringComparer.Ordinal).Count() == allocated.Length
            && allocated.All(memberId => roster.MemberIds.Contains(memberId, StringComparer.Ordinal));
    }

    /// <summary>An unknown zone never comes from the parser, so it is a programming error here.</summary>
    private static int RotationCount(int setterZone)
    {
        var rotationCount = SetterZoneSequence.IndexOf(setterZone);
        return rotationCount == NotFound
            ? throw new ArgumentOutOfRangeException(nameof(setterZone), setterZone, "Not a setter zone.")
            : rotationCount;
    }

    /// <summary>The entry after the zone, or the first one past the end, as <c>?? FIRST_ZONE</c> in TypeScript.</summary>
    private static int FollowingIn(ImmutableArray<int> sequence, int zone)
    {
        var next = sequence.IndexOf(zone) + OneStep;
        return next < sequence.Length ? sequence[next] : sequence.First();
    }
}
