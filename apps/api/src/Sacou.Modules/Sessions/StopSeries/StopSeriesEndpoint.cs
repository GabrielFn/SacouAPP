using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;

namespace Sacou.Modules.Sessions.StopSeries;

/// <summary>
/// <c>POST /v1/groups/{groupId}/series/{seriesId}/stop</c> (<c>ManageRounds</c>): "parar de repetir". The
/// occurrence already made stays (the admin cancels it if they want). Stopping again is a 204. The series is
/// looked up by <c>(group_id, id)</c>: one of another group is <c>sessions.series-not-found</c>.
/// </summary>
internal static class StopSeriesEndpoint
{
    public const string Name = "StopSeries";
    public const string Route = "/series/{seriesId:guid}/stop";

    public static RouteGroupBuilder MapStopSeries(this RouteGroupBuilder group)
    {
        group.MapPost(Route, HandleAsync).WithName(Name).RequireCapability(GroupCapability.ManageRounds);
        return group;
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid seriesId, HttpContext context, IRoundStore store, TimeProvider time, CancellationToken cancellationToken)
    {
        var stopped = await store.StopSeriesAsync(context.RoundAccess().GroupId, new SeriesId(seriesId), time.GetUtcNow(), cancellationToken)
            .ConfigureAwait(false);
        return stopped.IsSuccess ? TypedResults.NoContent() : ProblemResults.From(stopped.Error);
    }
}
