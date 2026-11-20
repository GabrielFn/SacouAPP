using System.Globalization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Modules.Stats.Projections;
using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.GetMyStats;

/// <summary>The seasons of the profile: the civil year in the zone of the rounds.</summary>
internal static class Seasons
{
    public const int First = 2000;
    public const int Last = 2100;

    public const string TimeZoneId = "America/Sao_Paulo";

    private static readonly Lazy<TimeZoneInfo> Zone = new(() => TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId));

    /// <summary>The season of an instant: on 1 January at 01:00 UTC it is still 31 December in São Paulo.</summary>
    public static int Of(DateTimeOffset instant) => TimeZoneInfo.ConvertTime(instant, Zone.Value).Year;

    /// <summary>Digits only, from <see cref="First"/> to <see cref="Last"/>; none is the current season.</summary>
    public static int? Parse(string? year, DateTimeOffset now) =>
        year is null ? Of(now)
        : int.TryParse(year, NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) && parsed is >= First and <= Last ? parsed
        : null;
}

/// <summary>The reads of a season: the fresh rounds of a group, then the MVP vote of each (ADR 0072, D11).</summary>
internal sealed record SeasonReads(StatsProjector Projector, MvpOutcomes Outcomes);

/// <summary>
/// <c>GET /v1/me/stats?year=2026</c> (<c>GetMyStats</c>): the person's own season, in total and by group (rule 3.7),
/// resolved from the token; there is no route for the stats of someone else. Every group of the person is freshened,
/// which may replay the stale rounds, so it is limited by <c>court-sync</c> (ADR 0062). <c>no-store</c>.
/// </summary>
internal static class GetMyStatsEndpoint
{
    public const string Name = "GetMyStats";
    public const string Route = "/v1/me/stats";

    public static IEndpointRouteBuilder MapGetMyStats(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet(Route, HandleAsync).WithName(Name).RequireAuthorization().RequireRateLimiting(RateLimitPolicies.CourtSync)
            .WithNoStore()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status403Forbidden);
        return endpoints;
    }

    private static async Task<Results<Ok<MyStatsReport>, ProblemHttpResult>> HandleAsync(
        string? year,
        ICurrentUser currentUser,
        IUserMemberships memberships,
        StatsProjector projector,
        MvpOutcomes outcomes,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var report = await ReportAsync(year, currentUser, memberships, new SeasonReads(projector, outcomes), time, cancellationToken)
            .ConfigureAwait(false);
        return report.ToHttpResult(TypedResults.Ok);
    }

    private static async Task<Result<MyStatsReport>> ReportAsync(
        string? year,
        ICurrentUser currentUser,
        IUserMemberships memberships,
        SeasonReads reads,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        if (Seasons.Parse(year, time.GetUtcNow()) is not { } season)
        {
            return Result.Failure<MyStatsReport>(StatsErrors.YearInvalid);
        }

        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<MyStatsReport>(user.Error);
        }

        var found = await memberships.ListAsync(user.Value.UserId, cancellationToken).ConfigureAwait(false);
        var rounds = new List<MembershipRounds>(found.Count);
        foreach (var membership in found)
        {
            var groupRounds = await reads.Projector.GetGroupAsync(membership.GroupId, cancellationToken).ConfigureAwait(false);
            var votes = await reads.Outcomes.OfRoundsAsync(membership.GroupId, groupRounds, cancellationToken).ConfigureAwait(false);
            rounds.Add(new MembershipRounds(membership, groupRounds, votes));
        }

        return Result.Success(Report(season, rounds));
    }

    /// <summary>
    /// A group the person left shows only with a match in the season, an active one always; the total sums the groups
    /// shown, so it always equals the sum of the list.
    /// </summary>
    private static MyStatsReport Report(int season, IReadOnlyList<MembershipRounds> rounds)
    {
        var shown = rounds
            .Select((membership, joined) => (Rounds: membership, Totals: PlayerTotals.Of(membership, season), Joined: joined))
            .Where(group => group.Rounds.Membership.Active || group.Totals.MatchesPlayed > 0)
            .OrderByDescending(group => group.Totals.MatchesPlayed)
            .ThenBy(group => group.Joined)
            .ToList();
        return new MyStatsReport(
            season,
            MyStatsTotalsReport.From(PlayerTotals.OfPerson([.. shown.Select(group => group.Rounds)], season)),
            [.. shown.Select(group => GroupOf(group.Rounds.Membership, group.Totals))]);
    }

    private static MyStatsGroupReport GroupOf(UserMembership membership, SeasonTotals totals) => new(
        membership.GroupId,
        membership.GroupName,
        membership.Modality is { } modality ? GameModalities.CodeOf(modality) : null,
        totals.MatchesPlayed,
        totals.Wins,
        totals.Losses,
        totals.PlusMinus,
        totals.LongestWinStreak,
        totals.MvpCount,
        totals.Rounds,
        totals.RoundsHeld);
}
