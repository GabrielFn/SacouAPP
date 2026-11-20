using System.Collections.Immutable;
using System.Globalization;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.Domain.Ratings;

/// <summary>Indoor and beach are rated apart; the two beach modalities share a pool (ADR 0071, rule 20).</summary>
internal sealed record RatingPoolKind
{
    public static readonly RatingPoolKind Indoor = new("indoor");
    public static readonly RatingPoolKind Beach = new("beach");

    /// <summary>In the order of the output: <c>indoor</c> first.</summary>
    public static readonly ImmutableArray<RatingPoolKind> All = [Indoor, Beach];

    private RatingPoolKind(string code) => Code = code;

    public string Code { get; }

    /// <summary>The pool of a stored code, or <c>null</c> for any other text.</summary>
    public static RatingPoolKind? FromCode(string code) =>
        All.FirstOrDefault(pool => string.Equals(pool.Code, code, StringComparison.Ordinal));
}

/// <summary>The side that won a rated match; a match without a winner has none.</summary>
internal enum MatchSide
{
    A,
    B,
}

/// <summary>
/// A finished match as <c>getMatchResults</c> gives it: only <c>Winner</c>, the teams and who stood on the
/// court in a rally matter (rule 19).
/// </summary>
internal sealed record RatedMatch(
    string MatchId,
    MatchSide? Winner,
    ImmutableArray<MemberId> TeamA,
    ImmutableArray<MemberId> TeamB,
    ImmutableArray<MemberId> OnCourtA,
    ImmutableArray<MemberId> OnCourtB);

/// <summary>A round of the group with its finished matches, in the order of the <c>MatchEnded</c> events.</summary>
internal sealed record RatedRound(Guid RoundId, DateTimeOffset StartsAt, bool Canceled, RatingPoolKind Pool, ImmutableArray<RatedMatch> Matches);

/// <summary>The rating of a member in a pool, with the seed it started from (risk 5, calibration). Key order of the contract.</summary>
internal sealed record MemberRating(MemberId MemberId, RatingPoolKind Pool, int SeedTenths, SeedSource SeedSource, Skill Skill, int MatchesRated);

/// <summary>
/// Port of <c>packages/rating/src/rate-pool.ts</c>: the hidden rating of a group (ADR 0047 and 0071, rules
/// 18 to 25), rebuilt from scratch on every call, never incremented. Nothing here is logged or returned by
/// a route.
/// </summary>
internal static class RatingPool
{
    public static readonly Error InvalidLevel = new("stats.rating-invalid-level", ErrorKind.Validation);
    public static readonly Error DuplicateSeed = new("stats.rating-duplicate-seed", ErrorKind.Validation);

    /// <summary>
    /// The same member twice on the court of a match, on one side or on both. The engine never builds such a
    /// match (a member is in one team of a match only); the TypeScript fold would let the last update win,
    /// so the port refuses it instead (part 2, condition 1).
    /// </summary>
    public static readonly Error DuplicateMember = new("stats.rating-duplicate-member", ErrorKind.Validation);

    private const string RoundIdFormat = "D";

    /// <summary>A member nobody graded starts at 3.0 with a high σ, as <c>IMemberLevels</c> resolves it.</summary>
    private static readonly RatingSeedLevel DefaultLevel = new(SeedRules.BaseLevelTenths, SeedSource.Default);

    /// <summary>
    /// A fold over the finished matches of the rounds in play order (not canceled, by <c>StartsAt</c>, then by
    /// the round id as ordinal text, like TypeScript), indoor and beach apart, each member seeded with the
    /// current level. Members come in order of first appearance (<c>teams.a</c>, <c>teams.b</c>, then the
    /// court), <c>indoor</c> first.
    /// </summary>
    public static Result<ImmutableArray<MemberRating>> Rate(
        RatingParams parameters,
        ImmutableArray<RatingSeed> seeds,
        ImmutableArray<RatedRound> rounds)
    {
        if (seeds.Any(seed => !SeedRules.IsValidLevelTenths(seed.LevelTenths)))
        {
            return Result.Failure<ImmutableArray<MemberRating>>(InvalidLevel);
        }

        if (seeds.DistinctBy(seed => seed.MemberId).Count() != seeds.Length)
        {
            return Result.Failure<ImmutableArray<MemberRating>>(DuplicateSeed);
        }

        if (rounds.SelectMany(round => round.Matches).Any(HasRepeatedMember))
        {
            return Result.Failure<ImmutableArray<MemberRating>>(DuplicateMember);
        }

        var levels = seeds.ToImmutableDictionary(seed => seed.MemberId, seed => new RatingSeedLevel(seed.LevelTenths, seed.Source));
        var ordered = InPlayOrder(rounds);
        return Result.Success<ImmutableArray<MemberRating>>(
            [.. RatingPoolKind.All.SelectMany(pool => RateOnePool(parameters, levels, ordered, pool))]);
    }

    private static bool HasRepeatedMember(RatedMatch match)
    {
        var onCourt = match.OnCourtA.Concat(match.OnCourtB).ToList();
        return onCourt.Distinct().Count() != onCourt.Count;
    }

    private static ImmutableArray<RatedRound> InPlayOrder(ImmutableArray<RatedRound> rounds) =>
        [.. rounds
            .Where(round => !round.Canceled)
            .OrderBy(round => round.StartsAt.UtcTicks)
            .ThenBy(round => round.RoundId.ToString(RoundIdFormat, CultureInfo.InvariantCulture), StringComparer.Ordinal)];

    private static IEnumerable<MemberRating> RateOnePool(
        RatingParams parameters,
        ImmutableDictionary<MemberId, RatingSeedLevel> levels,
        ImmutableArray<RatedRound> rounds,
        RatingPoolKind pool)
    {
        ImmutableArray<RatedMatch> matches = [.. rounds.Where(round => round.Pool == pool).SelectMany(round => round.Matches)];
        var standings = new Dictionary<MemberId, Standing>();
        foreach (var match in matches.Where(IsRated))
        {
            RateMatch(parameters, levels, standings, match);
        }

        return MembersInOrder(matches).Select(memberId =>
        {
            var level = LevelOf(levels, memberId);
            var standing = StandingOf(parameters, levels, standings, memberId);
            return new MemberRating(memberId, pool, level.LevelTenths, level.Source, standing.Skill, standing.MatchesRated);
        });
    }

    /// <summary>A match with no winner tells too little, and one with nobody in a rally rates no one (rules 18 and 19).</summary>
    private static bool IsRated(RatedMatch match) => match.Winner is not null && !match.OnCourtA.IsEmpty && !match.OnCourtB.IsEmpty;

    /// <summary>Only who stood on the court in a rally is rated, with weight 1; the bench is not. The fold map is local.</summary>
    private static void RateMatch(
        RatingParams parameters,
        ImmutableDictionary<MemberId, RatingSeedLevel> levels,
        Dictionary<MemberId, Standing> standings,
        RatedMatch match)
    {
        var (winners, losers) = match.Winner == MatchSide.A ? (match.OnCourtA, match.OnCourtB) : (match.OnCourtB, match.OnCourtA);
        ImmutableArray<Skill> SkillsOf(ImmutableArray<MemberId> members) =>
            [.. members.Select(memberId => StandingOf(parameters, levels, standings, memberId).Skill)];

        var rated = PlackettLuce.Rate(parameters, SkillsOf(winners), SkillsOf(losers));
        ImmutableArray<(MemberId MemberId, Standing Standing)> updates =
        [
            .. winners.Select((memberId, index) => (memberId, Next(parameters, levels, standings, memberId, rated.Winners[index]))),
            .. losers.Select((memberId, index) => (memberId, Next(parameters, levels, standings, memberId, rated.Losers[index]))),
        ];
        foreach (var (memberId, standing) in updates)
        {
            standings[memberId] = standing;
        }
    }

    private static Standing Next(
        RatingParams parameters,
        ImmutableDictionary<MemberId, RatingSeedLevel> levels,
        Dictionary<MemberId, Standing> standings,
        MemberId memberId,
        Skill skill) =>
        new(skill, StandingOf(parameters, levels, standings, memberId).MatchesRated + 1);

    private static Standing StandingOf(
        RatingParams parameters,
        ImmutableDictionary<MemberId, RatingSeedLevel> levels,
        Dictionary<MemberId, Standing> standings,
        MemberId memberId)
    {
        if (standings.TryGetValue(memberId, out var standing))
        {
            return standing;
        }

        var level = LevelOf(levels, memberId);
        return new Standing(SeedRules.SeedOf(parameters, level.LevelTenths, level.Source), MatchesRated: 0);
    }

    private static RatingSeedLevel LevelOf(ImmutableDictionary<MemberId, RatingSeedLevel> levels, MemberId memberId) =>
        levels.GetValueOrDefault(memberId, DefaultLevel);

    /// <summary>Members in order of first appearance: <c>teams.a</c>, <c>teams.b</c>, then the court, match by match.</summary>
    private static IEnumerable<MemberId> MembersInOrder(ImmutableArray<RatedMatch> matches) =>
        matches.SelectMany(match => match.TeamA.Concat(match.TeamB).Concat(match.OnCourtA).Concat(match.OnCourtB)).Distinct();

    private sealed record RatingSeedLevel(int LevelTenths, SeedSource Source);

    private sealed record Standing(Skill Skill, int MatchesRated);
}
