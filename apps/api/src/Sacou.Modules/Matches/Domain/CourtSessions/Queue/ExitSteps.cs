using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Queue;

/// <summary>One team leaving, by the mode of the group, against the queue that is left (ADR 0050).</summary>
internal sealed record ExitStepContext(
    QueueSideChoice Choice,
    TeamQueue Pool,
    TeamRoster Roster,
    TeamState? Rotation,
    TeamSide Side,
    CourtSessionState State);

/// <summary>
/// The side after the step: its team and rotation, whether a new team came in (<c>Entered</c>, with the
/// rotation to set), the partial exits, who left (as teams or as singles) and the queue that is left.
/// </summary>
internal sealed record ExitStepOutcome(
    bool Entered,
    ImmutableArray<PartialExit> Exits,
    TeamQueue Leaving,
    TeamQueue Pool,
    TeamRoster Roster,
    TeamState? Rotation);

/// <summary>Whether the rotation goes on with the ones who come in, or the lineup is set again.</summary>
internal enum RotationAfterExit
{
    Kept,
    Reset,
}

/// <summary>Port of <c>queue/exit-steps.ts</c>: the inheritance of the place, the libero and the criterion of E2.6.</summary>
internal static class ExitSteps
{
    /// <summary>Nobody waits for this side: nothing changes (rule 1 of <c>fila.md</c>).</summary>
    public static ExitStepOutcome Stay(ExitStepContext context) =>
        new(Entered: false, [], TeamQueue.Empty, context.Pool, context.Roster, context.Rotation);

    /// <summary>The first team of the queue takes the side, with its rotation off; <c>null</c> when no team waits.</summary>
    public static ExitStepOutcome? EnterFirstTeam(ExitStepContext context, Func<TeamRoster, TeamQueue> leaving)
    {
        if (context.Pool.Teams.IsEmpty)
        {
            return null;
        }

        return new ExitStepOutcome(
            Entered: true,
            [],
            leaving(context.Roster),
            context.Pool with { Teams = context.Pool.Teams.RemoveAt(0) },
            context.Pool.Teams[0],
            Rotation: null);
    }

    /// <summary>As many singles as wait come in, up to the whole team (rule 3 of <c>fila.md</c>).</summary>
    public static Result<ExitStepOutcome, QueueCommandError> ReplaceBySingles(ExitStepContext context, RotationAfterExit rotationAfter)
    {
        var players = context.Pool.Players;
        var count = Math.Min(players.Length, context.Roster.MemberIds.Length);
        return ReplaceMembers(context, [.. players.Take(count)], context.Pool with { Players = [.. players.Skip(count)] }, rotationAfter);
    }

    /// <summary>
    /// The first <paramref name="incoming"/> of the queue replace as many of the team, chosen by the
    /// criterion. The pairs follow the order of the team, never the order of the criterion, and whoever
    /// leaves goes to the end of the queue in that order. <paramref name="rest"/> is the queue without the
    /// ones who came in.
    /// </summary>
    public static Result<ExitStepOutcome, QueueCommandError> ReplaceMembers(
        ExitStepContext context,
        ImmutableArray<string> incoming,
        TeamQueue rest,
        RotationAfterExit rotationAfter)
    {
        var memberIds = context.Roster.MemberIds;
        if (QueueExitCriteria.ChooseOutgoing(context.Choice, new QueueExitCandidates(incoming.Length, memberIds, context.State)) is not { } chosen)
        {
            return Result<ExitStepOutcome, QueueCommandError>.Failure(QueueCommandError.Refused(QueueRefusalCodes.InvalidExitChoice));
        }

        ImmutableArray<string> outgoing = [.. memberIds.Where(memberId => chosen.Contains(memberId, StringComparer.Ordinal))];
        string IncomingFor(string memberId) => outgoing.IndexOf(memberId, StringComparer.Ordinal) is var index and >= 0 ? incoming[index] : memberId;
        var kept = rotationAfter == RotationAfterExit.Kept ? context.Rotation : null;
        ImmutableArray<PartialExit> exits = [.. outgoing.Select(memberId => new PartialExit(
            MatchHistory.GetConsecutiveMatches(context.State, memberId),
            IncomingFor(memberId),
            memberId,
            PlaceOf(memberId, memberIds, kept),
            context.Side))];
        return Result<ExitStepOutcome, QueueCommandError>.Success(new ExitStepOutcome(
            Entered: rotationAfter == RotationAfterExit.Reset,
            exits,
            new TeamQueue(outgoing, []),
            rest,
            new TeamRoster([.. memberIds.Select(IncomingFor)]),
            kept is null ? null : ReplaceInTeamState(kept, IncomingFor)));
    }

    private static PartialExitPlace PlaceOf(string memberId, ImmutableArray<string> memberIds, TeamState? teamState)
    {
        if (teamState is null)
        {
            return PartialExitPlace.Team(memberIds.IndexOf(memberId, StringComparer.Ordinal));
        }

        var inLineup = teamState.Lineup.IndexOf(memberId, StringComparer.Ordinal);
        if (inLineup >= 0)
        {
            return PartialExitPlace.Lineup(inLineup);
        }

        return string.Equals(teamState.Libero?.MemberId, memberId, StringComparison.Ordinal)
            ? PartialExitPlace.Libero
            : PartialExitPlace.Bench(teamState.Bench.IndexOf(memberId, StringComparer.Ordinal));
    }

    /// <summary>
    /// Whoever comes in takes the place of whoever leaves. In the place of the libero, the one who comes in
    /// goes to the end of the bench, and the team has no libero (decision of the product owner).
    /// </summary>
    private static TeamState ReplaceInTeamState(TeamState teamState, Func<string, string> incomingFor)
    {
        var replaced = teamState with
        {
            Bench = [.. teamState.Bench.Select(incomingFor)],
            Lineup = [.. teamState.Lineup.Select(incomingFor)],
        };
        if (teamState.Libero is not { } libero)
        {
            return replaced;
        }

        var liberoIncoming = incomingFor(libero.MemberId);
        return string.Equals(liberoIncoming, libero.MemberId, StringComparison.Ordinal)
            ? replaced
            : replaced with { Bench = replaced.Bench.Add(liberoIncoming), Libero = null };
    }
}
