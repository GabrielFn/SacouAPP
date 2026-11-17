using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Writes;

/// <summary>
/// Every member id an event names: teams, rotations, bench, libero, queue and author (ADR 0060, D11).
/// An event whose payload does not parse names nobody: the replay refuses it first.
/// </summary>
internal static class CourtEventMembers
{
    public static ImmutableArray<string> Collect(EventEnvelope envelope)
    {
        var parsed = ScorePayloadParser.Parse(envelope.Type, envelope.Payload);
        return parsed.IsFailure ? [] : [.. Of(parsed.Value).Distinct(StringComparer.Ordinal)];
    }

    /// <summary>The distinct member ids of many events, in order of appearance, for one query to the group.</summary>
    public static ImmutableArray<string> Collect(IEnumerable<EventEnvelope> envelopes) =>
        [.. envelopes.SelectMany(envelope => Collect(envelope)).Distinct(StringComparer.Ordinal)];

    private static IEnumerable<string> Of(ScorePayload payload) => payload switch
    {
        MatchStartedPayload started => started.Teams.A.MemberIds
            .Concat(started.Teams.B.MemberIds)
            .Concat(OfTeam(started.Rotations.A))
            .Concat(OfTeam(started.Rotations.B))
            .Concat(OfQueue(started.Queue)),
        LineupChangedPayload lineup => lineup.Lineup.Concat(lineup.Bench).Concat(OfLibero(lineup.Libero)),
        QueueChangedPayload queue => OfQueue(queue.Queue),
        PointAttributedPayload { Author: { } author } => [author],
        _ => [],
    };

    private static IEnumerable<string> OfTeam(TeamState? teamState) =>
        teamState is null ? [] : teamState.Lineup.Concat(teamState.Bench).Concat(OfLibero(teamState.Libero));

    private static IEnumerable<string> OfLibero(TeamLibero? libero) => libero is null ? [] : [libero.MemberId];

    private static IEnumerable<string> OfQueue(TeamQueue queue) =>
        queue.Players.Concat(queue.Teams.SelectMany(team => team.MemberIds));
}
