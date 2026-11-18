using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Sacou.Http;
using Sacou.Http.RateLimiting;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.AppendCourtEvents;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Modules.Sessions.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Matches.ListCourtEvents;

/// <summary>
/// One page of the stored stream, for the contract only: the endpoint writes each envelope as it was stored, never
/// re-serialized (ADR 0063, D7). <see cref="LastPosition"/> is the position of the last envelope of the page (or where
/// the read started, with an empty page); the stream is read to the end when it equals <see cref="EventCount"/>.
/// </summary>
internal sealed record ListCourtEventsResponse(IReadOnlyList<JsonObject> Events, long LastPosition, int EventCount);

/// <summary>
/// <c>GET /v1/groups/{groupId}/rounds/{roundId}/court-sessions/{courtSessionId}/events?after={position}</c>
/// (<c>ListCourtEvents</c>): the phone that takes the court over continues from the server's stream (ADR 0063, D7),
/// in pages of at most 500 envelopes or 1 MiB. Only <c>WriteCourt</c>; a stream of another round or group is the same
/// 404 as none. <c>no-store</c>; <c>court-sync</c> (ADR 0062).
/// </summary>
internal static class ListCourtEventsEndpoint
{
    public const string Name = "ListCourtEvents";
    public const string Route = "/rounds/{roundId:guid}/court-sessions/{courtSessionId:guid}/events";

    public const int MaxEventsPerPage = 500;
    public const long MaxBytesPerPage = 1024 * 1024;

    private const long FromTheStart = 0;
    private const string JsonContentType = "application/json";

    public static RouteGroupBuilder MapListCourtEvents(this RouteGroupBuilder group)
    {
        group.MapGet(Route, HandleAsync).WithName(Name).RequireRateLimiting(RateLimitPolicies.CourtSync)
            .RequireCapability(GroupCapability.WriteCourt)
            .WithNoStore()
            .Produces<ListCourtEventsResponse>(StatusCodes.Status200OK, JsonContentType)
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return group;
    }

    /// <summary>The <c>after</c> query is the position to read after, an integer from zero; none reads from the start.</summary>
    private static async Task<IResult> HandleAsync(
        Guid roundId,
        Guid courtSessionId,
        string? after,
        HttpContext context,
        IRoundDirectory rounds,
        ICourtSessionReader reader,
        CancellationToken cancellationToken)
    {
        if (Position(after) is not { } position)
        {
            return ProblemResults.From(CourtErrors.PositionInvalid);
        }

        var access = context.CourtAccess();
        var page = await ReadAsync(access.GroupId, roundId, courtSessionId, position, rounds, reader, cancellationToken).ConfigureAwait(false);
        return page.IsSuccess ? new RawEventPageResult(page.Value) : ProblemResults.From(page.Error);
    }

    /// <summary>Digits only, so no sign, space, separator nor exponent; past <c>long</c> is refused too.</summary>
    private static long? Position(string? after) =>
        after is null ? FromTheStart
        : long.TryParse(after, NumberStyles.None, CultureInfo.InvariantCulture, out var position) ? position
        : null;

    private static async Task<Result<CourtEventPage>> ReadAsync(
        Guid groupId, Guid roundId, Guid courtSessionId, long after, IRoundDirectory rounds, ICourtSessionReader reader, CancellationToken cancellationToken)
    {
        if (await rounds.FindAsync(groupId, roundId, cancellationToken).ConfigureAwait(false) is null)
        {
            return Result.Failure<CourtEventPage>(RoundDirectoryErrors.RoundNotFound);
        }

        var page = await reader.ListEventsAsync(groupId, roundId, courtSessionId, after, MaxEventsPerPage, MaxBytesPerPage, cancellationToken)
            .ConfigureAwait(false);
        return page is null ? Result.Failure<CourtEventPage>(CourtErrors.CourtSessionNotFound) : Result.Success(page);
    }

    /// <summary>Writes <c>{ events, lastPosition, eventCount }</c> with each envelope's stored text as is.</summary>
    private sealed class RawEventPageResult(CourtEventPage page) : IResult
    {
        public async Task ExecuteAsync(HttpContext httpContext)
        {
            ArgumentNullException.ThrowIfNull(httpContext);
            httpContext.Response.StatusCode = StatusCodes.Status200OK;
            httpContext.Response.ContentType = JsonContentType;
            var writer = new Utf8JsonWriter(httpContext.Response.BodyWriter);
            await using (writer.ConfigureAwait(false))
            {
                writer.WriteStartObject();
                writer.WriteStartArray("events");
                foreach (var envelope in page.Envelopes)
                {
                    writer.WriteRawValue(envelope);
                }

                writer.WriteEndArray();
                writer.WriteNumber("lastPosition", page.LastPosition);
                writer.WriteNumber("eventCount", page.EventCount);
                writer.WriteEndObject();
                await writer.FlushAsync(httpContext.RequestAborted).ConfigureAwait(false);
            }
        }
    }
}
