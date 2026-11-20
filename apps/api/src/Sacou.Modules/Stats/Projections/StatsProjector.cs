using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.Infrastructure;

namespace Sacou.Modules.Stats.Projections;

/// <summary>
/// A round of the group with its fresh after-game: the summary of its stream (empty with none), and the key it was
/// built from. Only ids and integers.
/// </summary>
internal sealed record RoundProjection(RoundFacts Facts, CourtStreamHead? Stream, int EventCount, string FactsHash, SessionSummary Summary)
{
    /// <summary>Only a round still scheduled counts in the sums and in the rating; a canceled one is only readable (3.6).</summary>
    public bool Counts => Facts.State == RoundState.Scheduled && Stream is not null;

    public override string ToString() => nameof(RoundProjection);
}

/// <summary>
/// "Correção recalcula tudo" (ADR 0071, 3.9): every projection is a cache of a pure function of the stream and the
/// facts of its round, rebuilt whole when its key changes, never incremented. Then the pools of the group are folded
/// again when their inputs changed. No background work: a write after its commit, or a read, rebuilds.
/// </summary>
internal sealed class StatsProjector(
    IRoundFacts rounds,
    ICourtSessionResults courts,
    IStatsStore store,
    RatingProjector ratings,
    TimeProvider time,
    ILogger<StatsProjector> logger)
{
    /// <summary>
    /// The fresh after-game of one round of the group (E3.18 reads it for the ballot, L2), or null when the group has
    /// no such round. Refreshes the group on the way, so the rating follows any correction.
    /// </summary>
    public async Task<RoundProjection?> GetRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var group = await GetGroupAsync(groupId, cancellationToken).ConfigureAwait(false);
        return group.FirstOrDefault(projection => projection.Facts.RoundId == roundId);
    }

    /// <summary>Every round of the group, earliest first, each fresh; the stale ones are rebuilt, then the pools.</summary>
    public async Task<IReadOnlyList<RoundProjection>> GetGroupAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var facts = await rounds.ListAsync(groupId, cancellationToken).ConfigureAwait(false);
        if (facts.Count == 0)
        {
            return [];
        }

        var heads = (await courts.ListOfGroupAsync(groupId, cancellationToken).ConfigureAwait(false)).ToDictionary(head => head.RoundId);
        var stored = (await store.ListProjectionsAsync(groupId, cancellationToken).ConfigureAwait(false)).ToDictionary(row => row.RoundId);
        var projections = new List<RoundProjection>(facts.Count);
        foreach (var round in facts)
        {
            projections.Add(await FreshAsync(groupId, round, heads.GetValueOrDefault(round.RoundId), stored.GetValueOrDefault(round.RoundId), cancellationToken)
                .ConfigureAwait(false));
        }

        await ratings.RefreshAsync(groupId, projections, cancellationToken).ConfigureAwait(false);
        return projections;
    }

    private async Task<RoundProjection> FreshAsync(
        Guid groupId, RoundFacts facts, CourtStreamHead? head, RoundProjectionRow? row, CancellationToken cancellationToken)
    {
        var factsHash = ProjectionKeys.FactsHashOf(facts);
        if (head is null)
        {
            return new RoundProjection(facts, Stream: null, EventCount: 0, factsHash, SessionSummary.Empty);
        }

        if (row is not null && IsFresh(row, head, factsHash) && SummaryJson.Read(row.Summary) is { } summary)
        {
            return new RoundProjection(facts, head, row.EventCount, factsHash, summary);
        }

        return await RebuildAsync(groupId, facts, head, factsHash, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>A row built from more events than the head read is fresh too: the stream grew between the two reads.</summary>
    private static bool IsFresh(RoundProjectionRow row, CourtStreamHead head, string factsHash) =>
        row.CourtSessionId == head.CourtSessionId
        && row.EventCount >= head.EventCount
        && row.ProjectionVersion == ProjectionKeys.ProjectionVersion
        && string.Equals(row.FactsHash, factsHash, StringComparison.Ordinal);

    private async Task<RoundProjection> RebuildAsync(
        Guid groupId, RoundFacts facts, CourtStreamHead head, string factsHash, CancellationToken cancellationToken)
    {
        var started = time.GetTimestamp();
        var results = await courts.SummarizeAsync(head, facts.Summary, cancellationToken).ConfigureAwait(false);
        var projection = new RoundProjection(facts, head, results.EventCount, factsHash, results.Summary);
        var stored = await store.SaveProjectionAsync(RowOf(groupId, projection), MemberRowsOf(groupId, projection), cancellationToken)
            .ConfigureAwait(false);
        var elapsedMs = (long)time.GetElapsedTime(started).TotalMilliseconds;
        StatsLog.RoundRebuilt(logger, facts.RoundId, results.EventCount, stored, elapsedMs);
        return projection;
    }

    private RoundProjectionRow RowOf(Guid groupId, RoundProjection projection) => new()
    {
        RoundId = projection.Facts.RoundId,
        GroupId = groupId,
        CourtSessionId = projection.Stream!.CourtSessionId,
        EventCount = projection.EventCount,
        ProjectionVersion = ProjectionKeys.ProjectionVersion,
        FactsHash = projection.FactsHash,
        StartsAt = projection.Facts.StartsAt,
        LocalDate = projection.Facts.LocalDate,
        Counts = projection.Counts,
        Modality = GameModalities.CodeOf(projection.Facts.Summary.Modality),
        FinishedMatches = projection.Summary.FinishedMatches.Count,
        Summary = SummaryJson.Write(projection.Summary),
        RebuiltAt = time.GetUtcNow(),
    };

    /// <summary>A canceled round keeps its summary but has no member rows: it is in no sum (3.6).</summary>
    private static IReadOnlyList<RoundMemberStatsRow> MemberRowsOf(Guid groupId, RoundProjection projection)
    {
        if (!projection.Counts)
        {
            return [];
        }

        var mvps = projection.Summary.Mvp?.MemberIds.ToHashSet() ?? [];
        return [.. projection.Summary.Players.Select(player => new RoundMemberStatsRow
        {
            RoundId = projection.Facts.RoundId,
            MemberId = player.MemberId,
            GroupId = groupId,
            StartsAt = projection.Facts.StartsAt,
            LocalDate = projection.Facts.LocalDate,
            MatchesPlayed = player.MatchesPlayed,
            Wins = player.Wins,
            Losses = player.Losses,
            Undecided = player.Undecided,
            PlusMinus = player.PlusMinus,
            LongestWinStreak = player.LongestWinStreak,
            Results = ResultLetters.Of(player.Results),
            WasMvp = mvps.Contains(player.MemberId),
        })];
    }
}

/// <summary>The results of a member as one letter each, the stored form of <c>round_member_stats.results</c>.</summary>
internal static class ResultLetters
{
    public const char Win = 'w';
    public const char Loss = 'l';
    public const char Undecided = 'u';

    public static string Of(IEnumerable<MatchOutcome> results) => string.Concat(results.Select(result => result switch
    {
        MatchOutcome.Win => Win,
        MatchOutcome.Loss => Loss,
        _ => Undecided,
    }));
}
