namespace Sacou.Modules.Stats.Infrastructure;

/// <summary>
/// A row of <c>stats.round_projections</c>: the after-game of the one court stream of a round, a cache of a pure
/// function (ADR 0071). Fresh while its key (<see cref="CourtSessionId"/>, <see cref="EventCount"/>,
/// <see cref="ProjectionVersion"/>, <see cref="FactsHash"/>) matches the stream and the round. Only ids and integers.
/// </summary>
internal sealed class RoundProjectionRow
{
    public required Guid RoundId { get; init; }

    public required Guid GroupId { get; init; }

    public required Guid CourtSessionId { get; init; }

    public required int EventCount { get; init; }

    public required int ProjectionVersion { get; init; }

    /// <summary>SHA-256 of the facts of the round outside the stream, in hex: never the facts themselves.</summary>
    public required string FactsHash { get; init; }

    public required DateTimeOffset StartsAt { get; init; }

    public required DateOnly LocalDate { get; init; }

    /// <summary>False for a canceled round: its after-game stays readable, but it counts in no sum nor in the rating.</summary>
    public required bool Counts { get; init; }

    public required string Modality { get; init; }

    public required int FinishedMatches { get; init; }

    /// <summary>The summary as JSON (<c>jsonb</c>): matches, members, highlights, MVP and ranking, by id.</summary>
    public required string Summary { get; init; }

    public required DateTimeOffset RebuiltAt { get; init; }

    public override string ToString() => nameof(RoundProjectionRow);
}

/// <summary>
/// A row of <c>stats.round_member_stats</c>: the round of one member, for the sums of the card and the profile
/// (screens 14 and 15). Only for a round that counts; rebuilt with its projection.
/// </summary>
internal sealed class RoundMemberStatsRow
{
    public required Guid RoundId { get; init; }

    public required Guid MemberId { get; init; }

    public required Guid GroupId { get; init; }

    public required DateTimeOffset StartsAt { get; init; }

    public required DateOnly LocalDate { get; init; }

    public required int MatchesPlayed { get; init; }

    public required int Wins { get; init; }

    public required int Losses { get; init; }

    public required int Undecided { get; init; }

    public required int PlusMinus { get; init; }

    public required int LongestWinStreak { get; init; }

    /// <summary>One letter per finished match played, in order (<c>w</c>, <c>l</c>, <c>u</c>): the streak goes across rounds.</summary>
    public required string Results { get; init; }

    public required bool WasMvp { get; init; }

    public override string ToString() => nameof(RoundMemberStatsRow);
}

/// <summary>A row of <c>stats.rating_pools</c>: which inputs the stored ratings of a pool of a group were folded from.</summary>
internal sealed class RatingPoolRow
{
    public required Guid GroupId { get; init; }

    public required string Pool { get; init; }

    /// <summary>SHA-256 of the ordered rounds, their stream counts, the seeds and the parameters version, in hex.</summary>
    public required string InputsHash { get; init; }

    public required int ParamsVersion { get; init; }

    public required DateTimeOffset RebuiltAt { get; init; }
}

/// <summary>
/// A row of <c>stats.member_ratings</c>: the hidden rating of a member in a pool of a group (ADR 0047), with the seed
/// it started from (calibration, risk 5). Never in a route, an event, a log nor an export.
/// </summary>
internal sealed class MemberRatingRow
{
    public required Guid GroupId { get; init; }

    public required string Pool { get; init; }

    public required Guid MemberId { get; init; }

    public required double Mu { get; init; }

    public required double Sigma { get; init; }

    public required int SeedTenths { get; init; }

    public required string SeedSource { get; init; }

    public required int MatchesRated { get; init; }

    /// <summary>Never the values: a printed row would carry the rating to a log.</summary>
    public override string ToString() => nameof(MemberRatingRow);
}
