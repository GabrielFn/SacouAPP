using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.Appliers;

/// <summary>
/// Port of <c>SCORE_APPLIERS</c>. Each applier applies the recorded result, checks structure only, and
/// refuses with a <see cref="Result{TValue, TError}"/>, never an exception (ADR 0033, D11).
/// </summary>
internal static class ScoreAppliers
{
    public static readonly ImmutableDictionary<string, Func<CourtSessionState, EventEnvelope, Result<CourtSessionState, EventRejection>>> All =
        ImmutableDictionary.CreateRange(
            StringComparer.Ordinal,
            [
                Entry(ScoreEventTypes.MatchStarted, MatchAppliers.ApplyMatchStarted),
                Entry(ScoreEventTypes.PointScored, SetAppliers.ApplyPointScored),
                Entry(ScoreEventTypes.SetEnded, SetAppliers.ApplySetEnded),
                Entry(ScoreEventTypes.MatchEnded, MatchAppliers.ApplyMatchEnded),
                Entry(ScoreEventTypes.LineupChanged, TeamAppliers.ApplyLineupChanged),
                Entry(ScoreEventTypes.QueueChanged, TeamAppliers.ApplyQueueChanged),
                Entry(ScoreEventTypes.ServingTeamChanged, SetAppliers.ApplyServingTeamChanged),
                Entry(ScoreEventTypes.PointAttributed, TeamAppliers.ApplyPointAttributed),
            ]);

    public static ReplayConfig<CourtSessionState> Config(string courtSessionId, CourtSessionState? initialState = null) =>
        new(courtSessionId, initialState ?? CourtSessionState.Initial, All);

    private static KeyValuePair<string, Func<CourtSessionState, EventEnvelope, Result<CourtSessionState, EventRejection>>> Entry(
        string type,
        Func<CourtSessionState, EventEnvelope, Result<CourtSessionState, EventRejection>> applier) =>
        KeyValuePair.Create(type, applier);
}
