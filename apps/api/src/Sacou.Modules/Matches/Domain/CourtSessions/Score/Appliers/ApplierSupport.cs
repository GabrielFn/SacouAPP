using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;

/// <summary>What the appliers of <c>score/appliers.ts</c> share. Structure checks only, never a rule recalculated.</summary>
internal static class ApplierSupport
{
    private const int OneSet = 1;

    public static Result<CourtSessionState, EventRejection> Rejected() =>
        Result<CourtSessionState, EventRejection>.Failure(EventRejection.Instance);

    public static Result<CourtSessionState, EventRejection> Applied(CourtSessionState state) =>
        Result<CourtSessionState, EventRejection>.Success(state);

    public static MatchScore? FindOpenMatch(CourtSessionState state, string matchId) =>
        state.CurrentMatch is { } match && string.Equals(match.MatchId, matchId, StringComparison.Ordinal) ? match : null;

    public static MatchSet? FindOpenSet(MatchScore? match, int setNumber) =>
        match?.CurrentSet is { } set && set.SetNumber == setNumber ? set : null;

    public static CourtSessionState WithCurrentMatch(CourtSessionState state, MatchScore match) =>
        state with { CurrentMatch = match };

    public static MatchSet EmptySet(int setNumber, int targetPoints, TeamSide firstServer) =>
        new(firstServer, new BySide<int>(0, 0), firstServer, setNumber, targetPoints);

    public static int NextSetNumber(int setNumber) => setNumber + OneSet;

    public static BySide<TeamState?> RotateTeam(BySide<TeamState?> rotations, TeamSide team) =>
        rotations.Of(team) is { } teamState
            ? rotations.With(team, teamState with { SetterZone = RotationRules.NextSetterZone(teamState.SetterZone) })
            : rotations;

    public static bool IsMatchMember(BySide<TeamRoster> teams, string memberId) =>
        teams.A.MemberIds.Contains(memberId, StringComparer.Ordinal)
        || teams.B.MemberIds.Contains(memberId, StringComparer.Ordinal);

    public static bool IsFinishedMatchId(CourtSessionState state, string matchId) =>
        state.FinishedMatches.Any(finished => string.Equals(finished.Match.MatchId, matchId, StringComparison.Ordinal));
}
