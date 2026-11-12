using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Results;

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
        Guid seriesId, HttpContext context, StopSeriesHandler handler, CancellationToken cancellationToken)
    {
        var stopped = await handler.HandleAsync(context.RoundAccess(), new SeriesId(seriesId), cancellationToken).ConfigureAwait(false);
        return stopped.IsSuccess ? TypedResults.NoContent() : ProblemResults.From(stopped.Error);
    }
}

/// <summary>Stops a series of the caller's group and logs ids and the result code, nothing else.</summary>
internal sealed class StopSeriesHandler(IRoundStore store, TimeProvider time, ILogger<StopSeriesHandler> logger)
{
    public async Task<Result> HandleAsync(RoundAccess access, SeriesId series, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        var stopped = await store.StopSeriesAsync(access.GroupId, series, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        RoundLog.SeriesStopped(logger, access.GroupId.Value, series.Value, stopped.IsSuccess ? "ok" : stopped.Error.Code);
        return stopped;
    }
}
