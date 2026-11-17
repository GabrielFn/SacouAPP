using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.PlayerStatistics;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Attributions;

/// <summary>The rally of a point: the match right before it, the team that scored and the team that served.</summary>
internal sealed record Rally(MatchScore Match, TeamSide Team, TeamSide ServingTeam);

/// <summary>
/// Port of <c>findRally</c> and <c>isValidAuthor</c> of <c>attributions/commands.ts</c> and of
/// <c>attributions/plausibility.ts</c>: what the command checks before it records "De quem foi?". The
/// server runs it on a received <c>PointAttributed</c>, so an orphan or implausible one, which the
/// resolver would ignore in silence, is refused instead (ADR 0060, D10).
/// </summary>
internal static class AttributionPlausibility
{
    /// <summary>Only the server of the rally scores an ace (ADR 0031, P1).</summary>
    public static readonly ImmutableArray<PointKind> ServePointKinds = [PointKind.Ace];

    /// <summary>The libero never serves nor blocks, so these are never its points (ADR 0031, P1).</summary>
    public static readonly ImmutableArray<PointKind> LiberoImpossiblePointKinds = [PointKind.Ace, PointKind.Block];

    /// <summary>
    /// The rally of an active point of the match, from the state right before it, or null. Any set of
    /// the open match counts, the decided and the closed ones too; a point of another match does not.
    /// </summary>
    public static Rally? FindRally(Timeline<CourtSessionState> timeline, string matchId, string pointEventId)
    {
        var atPoint = timeline.Find(pointEventId);
        if (atPoint?.LastEvent is not { } pointEvent
            || PointScoredParser.ReadStored(pointEvent) is not { } point
            || !string.Equals(point.MatchId, matchId, StringComparison.Ordinal))
        {
            return null;
        }

        var before = atPoint.WithoutLast().StateOr(CourtSessionState.Initial).CurrentMatch;
        return before?.CurrentSet is { } set && string.Equals(before.MatchId, matchId, StringComparison.Ordinal)
            ? new Rally(before, point.Team, set.ServingTeam)
            : null;
    }

    /// <summary>Only an error of the opponent has no author; any other author stood on the court of the rally and is plausible.</summary>
    public static bool IsValidAuthor(Rally rally, PointKind kind, string? author)
    {
        if (PointKind.Authorless.Contains(kind) != (author is null))
        {
            return false;
        }

        return author is null
            || (MatchTallies.OnCourtInTheRally(rally.Match, rally.ServingTeam, rally.Team).Contains(author, StringComparer.Ordinal)
                && IsPlausibleAuthor(rally, kind, author));
    }

    /// <summary>
    /// An ace is only of the server of the rally, so the team that scored must have served, and with its
    /// rotation on the author must be in slot 1. The libero never has an ace nor a block. With the
    /// rotation off nobody is known to be in slot 1, nor to be the libero.
    /// </summary>
    public static bool IsPlausibleAuthor(Rally rally, PointKind kind, string author)
    {
        var teamState = rally.Match.Rotations.Of(rally.Team);
        if (string.Equals(teamState?.Libero?.MemberId, author, StringComparison.Ordinal) && LiberoImpossiblePointKinds.Contains(kind))
        {
            return false;
        }

        if (!ServePointKinds.Contains(kind))
        {
            return true;
        }

        return rally.ServingTeam == rally.Team
            && (teamState is null || string.Equals(RotationRules.GetServingPlayer(teamState.Lineup, teamState.SetterZone), author, StringComparison.Ordinal));
    }
}
