using System.Collections.Immutable;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Stats.Domain.Ratings;
using Sacou.Modules.Stats.Infrastructure;
using Sacou.Shared.Members;

namespace Sacou.Modules.Stats.Projections;

/// <summary>The pool of a typed modality (E3.9 part 3, condition 2): the codes of the catalog live only in the Groups.</summary>
internal static class RatingPoolMapping
{
    /// <summary>The sand is one pool, whatever the size of its teams (ADR 0071, rule 20).</summary>
    public static RatingPoolKind Of(GameModality modality) => GameModalities.IsBeach(modality) ? RatingPoolKind.Beach : RatingPoolKind.Indoor;

    public static SeedSource SourceOf(LevelSource source) => source switch
    {
        LevelSource.Admin => SeedSource.Admin,
        LevelSource.Suggested => SeedSource.Suggested,
        LevelSource.Default => SeedSource.Default,
        _ => throw new ArgumentOutOfRangeException(nameof(source), source, "Every level source has a seed source."),
    };
}

/// <summary>
/// The hidden rating of a group (ADR 0047 and 0071): a fold of every counted match of a pool from the seeds, redone
/// whole when the hash of its inputs changed, and swapped atomically. Only ids and counts reach a log; μ and σ never
/// leave the Stats.
/// </summary>
internal sealed class RatingProjector(
    IMemberLevels levels,
    IStatsStore store,
    RatingParams parameters,
    TimeProvider time,
    ILogger<RatingProjector> logger)
{
    public async Task RefreshAsync(Guid groupId, IReadOnlyList<RoundProjection> projections, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(projections);
        ImmutableArray<RoundProjection> counted = [.. projections.Where(projection => projection.Counts)];
        var seeds = await SeedsAsync(groupId, counted, cancellationToken).ConfigureAwait(false);
        var stored = (await store.ListPoolsAsync(groupId, cancellationToken).ConfigureAwait(false))
            .ToDictionary(row => row.Pool, row => row.InputsHash, StringComparer.Ordinal);
        var hashes = RatingPoolKind.All.ToImmutableDictionary(
            pool => pool,
            pool => ProjectionKeys.InputsHashOf(parameters.RatingParamsVersion, pool, InPlayOrder(counted, pool), SeedsOfPool(seeds, counted, pool)));
        ImmutableArray<RatingPoolKind> stale = [.. RatingPoolKind.All.Where(pool =>
            !string.Equals(stored.GetValueOrDefault(pool.Code), hashes[pool], StringComparison.Ordinal))];
        if (stale.IsEmpty)
        {
            return;
        }

        var rated = RatingPool.Rate(parameters, [.. seeds.Values], [.. counted.Select(RatedRoundOf)]);
        if (rated.IsFailure)
        {
            StatsLog.PoolNotRated(logger, groupId, rated.Error.Code);
            return;
        }

        foreach (var pool in stale)
        {
            ImmutableArray<MemberRatingRow> rows = [.. rated.Value.Where(rating => rating.Pool == pool).Select(rating => RowOf(groupId, rating))];
            await store.SwapPoolAsync(
                new RatingPoolRow { GroupId = groupId, Pool = pool.Code, InputsHash = hashes[pool], ParamsVersion = parameters.RatingParamsVersion, RebuiltAt = time.GetUtcNow() },
                rows,
                cancellationToken).ConfigureAwait(false);
            StatsLog.PoolRebuilt(logger, groupId, pool.Code, rows.Length);
        }
    }

    /// <summary>The current level of every member of a counted match (question 98, option 1): one query.</summary>
    private async Task<ImmutableDictionary<MemberId, RatingSeed>> SeedsAsync(
        Guid groupId, ImmutableArray<RoundProjection> counted, CancellationToken cancellationToken)
    {
        Guid[] members = [.. counted.SelectMany(MembersOf).Distinct()];
        if (members.Length == 0)
        {
            return ImmutableDictionary<MemberId, RatingSeed>.Empty;
        }

        var resolved = await levels.ResolveAsync(groupId, members, cancellationToken).ConfigureAwait(false);
        return resolved.ToImmutableDictionary(
            level => new MemberId(level.MemberId),
            level => new RatingSeed(new MemberId(level.MemberId), level.LevelTenths, RatingPoolMapping.SourceOf(level.Source)));
    }

    private static IEnumerable<Guid> MembersOf(RoundProjection projection) =>
        projection.Summary.FinishedMatches.SelectMany(match => match.TeamA.Concat(match.TeamB).Concat(match.OnCourtA).Concat(match.OnCourtB));

    /// <summary>The order of the fold (<see cref="RatingPool"/>): by start, then by the round id as text.</summary>
    private static IEnumerable<RoundProjection> InPlayOrder(ImmutableArray<RoundProjection> counted, RatingPoolKind pool) =>
        counted
            .Where(projection => RatingPoolMapping.Of(projection.Facts.Summary.Modality) == pool)
            .OrderBy(projection => projection.Facts.StartsAt.UtcTicks)
            .ThenBy(projection => projection.Facts.RoundId.ToString("D"), StringComparer.Ordinal);

    private static IEnumerable<RatingSeed> SeedsOfPool(
        ImmutableDictionary<MemberId, RatingSeed> seeds, ImmutableArray<RoundProjection> counted, RatingPoolKind pool)
    {
        var members = InPlayOrder(counted, pool).SelectMany(MembersOf).Select(id => new MemberId(id)).ToHashSet();
        return seeds.Values.Where(seed => members.Contains(seed.MemberId));
    }

    private static RatedRound RatedRoundOf(RoundProjection projection) => new(
        projection.Facts.RoundId,
        projection.Facts.StartsAt,
        Canceled: false,
        RatingPoolMapping.Of(projection.Facts.Summary.Modality),
        [.. projection.Summary.FinishedMatches.Select(match => new RatedMatch(
            match.MatchId.ToString("D"),
            match.Winner switch
            {
                CourtSide.A => MatchSide.A,
                CourtSide.B => MatchSide.B,
                _ => null,
            },
            Members(match.TeamA),
            Members(match.TeamB),
            Members(match.OnCourtA),
            Members(match.OnCourtB)))]);

    private static ImmutableArray<MemberId> Members(IReadOnlyList<Guid> ids) => [.. ids.Select(id => new MemberId(id))];

    private static MemberRatingRow RowOf(Guid groupId, MemberRating rating) => new()
    {
        GroupId = groupId,
        Pool = rating.Pool.Code,
        MemberId = rating.MemberId.Value,
        Mu = rating.Skill.Mu,
        Sigma = rating.Skill.Sigma,
        SeedTenths = rating.SeedTenths,
        SeedSource = rating.SeedSource.Code,
        MatchesRated = rating.MatchesRated,
    };
}
