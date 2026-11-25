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
/// again when their inputs changed. No background work and nothing on the write of the court (E3.9 part 4b,
/// condition 1): only a read rebuilds, under <c>court-sync</c>.
/// </summary>
/// <remarks>
/// The one way to read the Stats (condition 2 of part 4a): no consumer trusts a stored row or pool without comparing
/// its key with the inputs read now. A rebuild that lost a race and wrote an older value after a newer one is thus at
/// worst redone by the next read, never served as fresh.
/// </remarks>
internal sealed class StatsProjector(
    IRoundFacts rounds,
    ICourtSessionResults courts,
    IStatsStore store,
    RatingProjector ratings,
    RebuildBudget budget,
    GroupRebuildGate gate,
    TimeProvider time,
    ILogger<StatsProjector> logger)
{
    /// <summary>
    /// The fresh after-game of one round of the group (the summary route, and the ballot of E3.18, L2), or null when
    /// the group has no such round. Replays at most this round; the other rounds are read from their rows. The pools
    /// are folded again only when every other counted round is fresh, so the read never pays more than one replay;
    /// a pool waits for the read that freshens the last stale round of the group.
    /// </summary>
    public async Task<RoundProjection?> GetRoundAsync(Guid groupId, Guid roundId, CancellationToken cancellationToken)
    {
        var group = await LoadAsync(groupId, facts => facts.RoundId == roundId, cancellationToken).ConfigureAwait(false);
        var round = group.Fresh.FirstOrDefault(projection => projection.Facts.RoundId == roundId);
        if (round is null)
        {
            return null;
        }

        if (group.StaleCounted > 0)
        {
            StatsLog.PoolDeferred(logger, groupId, group.StaleCounted);
            return round;
        }

        await ratings.RefreshAsync(groupId, group.Fresh, cancellationToken).ConfigureAwait(false);
        return round;
    }

    /// <summary>Every round of the group, earliest first, each fresh; the stale ones are rebuilt, then the pools.</summary>
    public async Task<IReadOnlyList<RoundProjection>> GetGroupAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var group = await LoadAsync(groupId, _ => true, cancellationToken).ConfigureAwait(false);
        if (group.Fresh.Count > 0)
        {
            await ratings.RefreshAsync(groupId, group.Fresh, cancellationToken).ConfigureAwait(false);
        }

        return group.Fresh;
    }

    /// <summary>
    /// Every round of the group, earliest first, each fresh, without folding the pools: the export reads the person's
    /// rounds only, and leaves the hidden rating (and its log line, which names the group) to the reads that use it.
    /// </summary>
    public async Task<IReadOnlyList<RoundProjection>> ListRoundsAsync(Guid groupId, CancellationToken cancellationToken) =>
        (await LoadAsync(groupId, _ => true, cancellationToken).ConfigureAwait(false)).Fresh;

    /// <summary>
    /// The rounds of the group that are fresh after rebuilding the stale ones <paramref name="rebuild"/> allows, and how
    /// many stale ones that would count were left as they are.
    /// </summary>
    /// <remarks>
    /// The rebuilds go through the group's gate, one read at a time, which reads the rows again once in (another read
    /// may have rebuilt them while this one waited), and each takes one of the request's <see cref="RebuildBudget"/>.
    /// A read with no turn in time, or no budget left, leaves the stale rounds as they are, like the filter does
    /// (question 189): the next read completes them (ADR 0081, Part 2).
    /// </remarks>
    private async Task<GroupProjections> LoadAsync(Guid groupId, Func<RoundFacts, bool> rebuild, CancellationToken cancellationToken)
    {
        var facts = await rounds.ListAsync(groupId, cancellationToken).ConfigureAwait(false);
        if (facts.Count == 0)
        {
            return new GroupProjections([], StaleCounted: 0);
        }

        var heads = (await courts.ListOfGroupAsync(groupId, cancellationToken).ConfigureAwait(false)).ToDictionary(head => head.RoundId);
        var stored = await StoredRowsAsync(groupId, cancellationToken).ConfigureAwait(false);
        if (!facts.Any(round => NeedsRebuild(round, heads, stored, rebuild)))
        {
            return await ProjectAsync(groupId, facts, heads, stored, _ => false, cancellationToken).ConfigureAwait(false);
        }

        using var turn = await gate.TryEnterAsync(groupId, cancellationToken).ConfigureAwait(false);
        if (turn is null)
        {
            return await ProjectAsync(groupId, facts, heads, stored, _ => false, cancellationToken).ConfigureAwait(false);
        }

        stored = await StoredRowsAsync(groupId, cancellationToken).ConfigureAwait(false);
        return await ProjectAsync(groupId, facts, heads, stored, rebuild, cancellationToken).ConfigureAwait(false);
    }

    private async Task<Dictionary<Guid, RoundProjectionRow>> StoredRowsAsync(Guid groupId, CancellationToken cancellationToken) =>
        (await store.ListProjectionsAsync(groupId, cancellationToken).ConfigureAwait(false)).ToDictionary(row => row.RoundId);

    private static bool NeedsRebuild(
        RoundFacts round, Dictionary<Guid, CourtStreamHead> heads, Dictionary<Guid, RoundProjectionRow> stored, Func<RoundFacts, bool> rebuild)
    {
        var head = heads.GetValueOrDefault(round.RoundId);
        return head is not null && rebuild(round) && Stored(round, head, stored.GetValueOrDefault(round.RoundId)) is null;
    }

    private async Task<GroupProjections> ProjectAsync(
        Guid groupId,
        IReadOnlyList<RoundFacts> facts,
        Dictionary<Guid, CourtStreamHead> heads,
        Dictionary<Guid, RoundProjectionRow> stored,
        Func<RoundFacts, bool> rebuild,
        CancellationToken cancellationToken)
    {
        var fresh = new List<RoundProjection>(facts.Count);
        var staleCounted = 0;
        foreach (var round in facts)
        {
            var head = heads.GetValueOrDefault(round.RoundId);
            var row = stored.GetValueOrDefault(round.RoundId);
            var projection = Stored(round, head, row);
            if (projection is null && head is not null && rebuild(round) && budget.TryTake())
            {
                projection = await RebuildAsync(groupId, round, head, cancellationToken).ConfigureAwait(false);
            }

            if (projection is not null)
            {
                fresh.Add(projection);
            }
            else if (round.State == RoundState.Scheduled)
            {
                staleCounted++;
            }
        }

        return new GroupProjections(fresh, staleCounted);
    }

    /// <summary>The round as its row holds it, when the row is fresh; empty with no stream; null when it needs a replay.</summary>
    private static RoundProjection? Stored(RoundFacts facts, CourtStreamHead? head, RoundProjectionRow? row)
    {
        var factsHash = ProjectionKeys.FactsHashOf(facts);
        if (head is null)
        {
            return new RoundProjection(facts, Stream: null, EventCount: 0, factsHash, SessionSummary.Empty);
        }

        return row is not null && IsFresh(row, head, factsHash) && SummaryJson.Read(row.Summary) is { } summary
            ? new RoundProjection(facts, head, row.EventCount, factsHash, summary)
            : null;
    }

    /// <summary>A row built from more events than the head read is fresh too: the stream grew between the two reads.</summary>
    private static bool IsFresh(RoundProjectionRow row, CourtStreamHead head, string factsHash) =>
        row.CourtSessionId == head.CourtSessionId
        && row.EventCount >= head.EventCount
        && row.ProjectionVersion == ProjectionKeys.ProjectionVersion
        && string.Equals(row.FactsHash, factsHash, StringComparison.Ordinal);

    /// <summary>Null when the court cannot be summarized now (every build of a snapshot busy): the round stays stale.</summary>
    private async Task<RoundProjection?> RebuildAsync(Guid groupId, RoundFacts facts, CourtStreamHead head, CancellationToken cancellationToken)
    {
        var started = time.GetTimestamp();
        var factsHash = ProjectionKeys.FactsHashOf(facts);
        var results = await courts.SummarizeAsync(head, facts.Summary, cancellationToken).ConfigureAwait(false);
        if (results is null)
        {
            return null;
        }

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

/// <summary>The fresh rounds of a group, earliest first, and how many stale ones that would count were not rebuilt.</summary>
internal sealed record GroupProjections(IReadOnlyList<RoundProjection> Fresh, int StaleCounted);

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
