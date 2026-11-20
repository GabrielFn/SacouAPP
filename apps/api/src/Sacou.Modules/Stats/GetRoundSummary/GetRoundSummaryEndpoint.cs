using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Modules.Stats.Access;
using Sacou.Modules.Stats.MvpVoting;
using Sacou.Modules.Stats.Projections;

namespace Sacou.Modules.Stats.GetRoundSummary;

/// <summary>
/// <c>GET /v1/groups/{groupId}/rounds/{roundId}/summary</c> (<c>GetRoundSummary</c>): the after-game of the round to
/// any member of the group, the Jogador included (<c>ViewGroup</c>). A round of another group is the same 404
/// <c>sessions.round-not-found</c> as none; a round without a stream is 200 with no finished match. The read may
/// replay the stream once (a stale projection), so it is limited by <c>court-sync</c> (ADR 0062). <c>no-store</c>.
/// </summary>
internal static class GetRoundSummaryEndpoint
{
    public const string Name = "GetRoundSummary";
    public const string Route = "/rounds/{roundId:guid}/summary";

    public static RouteGroupBuilder MapGetRoundSummary(this RouteGroupBuilder group) => group.MapRoundRead(Route, Name, HandleAsync);

    private static async Task<Results<Ok<RoundSummaryReport>, ProblemHttpResult>> HandleAsync(
        Guid roundId, HttpContext context, StatsProjector projector, MvpOutcomes outcomes, CancellationToken cancellationToken)
    {
        var access = context.StatsAccess();
        var round = await projector.GetRoundAsync(access.GroupId, roundId, cancellationToken).ConfigureAwait(false);
        if (round is null)
        {
            return ProblemResults.From(RoundDirectoryErrors.RoundNotFound);
        }

        var vote = await outcomes.OfRoundAsync(access.GroupId, round, cancellationToken).ConfigureAwait(false);
        return TypedResults.Ok(RoundSummaryReport.From(round, vote));
    }
}
