using System.Collections.Immutable;
using System.Text;
using Microsoft.Extensions.Logging;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Matches.Access;
using Sacou.Modules.Matches.Contracts;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Sacou.Modules.Matches.Infrastructure;
using Sacou.Modules.Sessions.Contracts;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>The route values of a write, as the route proved them.</summary>
internal sealed record CourtRoute(Guid RoundId, Guid CourtSessionId);

/// <summary>
/// A write to the court stream in the order of ADR 0060, D8, failing closed: the body by bytes, each envelope, the
/// coherence of the request, the round, the members of the group (one query), all outside any lock; then, under the
/// stream's lock, the rules of <see cref="CourtWriteRules.Decide"/>. All or nothing. After the commit, a write that
/// stored a finished match or an undo tells the projections (E3.9, ADR 0071), best effort.
/// </summary>
internal sealed class AppendCourtEventsHandler(
    IRoundDirectory rounds,
    IGroupMembership membership,
    ICourtStreamStore store,
    IEnumerable<ICourtStreamChanged> listeners,
    TimeProvider time,
    ILogger<AppendCourtEventsHandler> logger)
{
    /// <summary>Only these change a finished match: a point of the open match changes nothing before its end (rule 1 of the statistics).</summary>
    private static readonly ImmutableHashSet<string> ResultChangingTypes = [ScoreEventTypes.MatchEnded, EventLogSchema.RevertedToEventType];

    private const string NoReason = "-";

    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    public async Task<Result<AppendCourtEventsResponse, CourtProblem>> HandleAsync(
        CourtAccess access, CourtRoute route, ReadOnlyMemory<byte> body, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        ArgumentNullException.ThrowIfNull(route);
        var started = time.GetTimestamp();
        var written = await WriteAsync(access, route, body, cancellationToken).ConfigureAwait(false);
        var elapsedMs = (long)time.GetElapsedTime(started).TotalMilliseconds;
        if (written.IsSuccess)
        {
            var (response, duplicates, changesResults) = written.Value;
            CourtLog.Stored(logger, route.CourtSessionId, response.Stored, duplicates, elapsedMs);
            if (changesResults)
            {
                await NotifyAsync(access.GroupId, route, cancellationToken).ConfigureAwait(false);
            }

            return Result<AppendCourtEventsResponse, CourtProblem>.Success(response);
        }

        var reason = written.Error.Extensions.GetValueOrDefault(CourtProblem.ReasonExtension) as string;
        CourtLog.Refused(logger, written.Error.Error.Code, reason ?? NoReason, elapsedMs);
        return Result<AppendCourtEventsResponse, CourtProblem>.Failure(written.Error);
    }

    /// <summary>
    /// Outside the lock and after the commit. A listener that fails leaves the projection stale, which the next read
    /// rebuilds: the write already happened, so it answers as it did. Only the stream id reaches the log.
    /// </summary>
    private async Task NotifyAsync(Guid groupId, CourtRoute route, CancellationToken cancellationToken)
    {
        foreach (var listener in listeners)
        {
            try
            {
                await listener.CourtStreamChangedAsync(groupId, route.RoundId, route.CourtSessionId, cancellationToken).ConfigureAwait(false);
            }
            catch (Exception exception) when (exception is not OutOfMemoryException)
            {
                CourtLog.ListenerFailed(logger, route.CourtSessionId, exception.GetType().Name);
            }
        }
    }

    private async Task<Result<(AppendCourtEventsResponse Response, int Duplicates, bool ChangesResults), CourtProblem>> WriteAsync(
        CourtAccess access, CourtRoute route, ReadOnlyMemory<byte> body, CancellationToken cancellationToken)
    {
        var received = EventBatchReader.ReadEnvelopes(body);
        if (received.IsFailure)
        {
            return Refuse(CourtProblems.From(received.Error));
        }

        var request = CourtWriteRequest.Create(
            Text(route.CourtSessionId), [.. received.Value.Select(item => item.Event)], SupportedVersions.EventSchemaVersions);
        if (request.IsFailure)
        {
            return Refuse(CourtProblems.From(request.Error));
        }

        var round = await rounds.FindAsync(access.GroupId, route.RoundId, cancellationToken).ConfigureAwait(false);
        if (round is null)
        {
            return Refuse(CourtProblem.Of(RoundDirectoryErrors.RoundNotFound));
        }

        var context = await ContextAsync(access, request.Value, cancellationToken).ConfigureAwait(false);
        var append = new CourtAppend(
            route.CourtSessionId,
            access.GroupId,
            route.RoundId,
            MayCreate: round.State == RoundState.Scheduled,
            time.GetUtcNow(),
            received.Value.ToImmutableDictionary(item => item.Event.Envelope.EventId, item => StrictUtf8.GetString(item.Utf8Json.Span), StringComparer.Ordinal));
        var outcome = await store.AppendAsync(append, stored => CourtWriteRules.Decide(stored, request.Value, context), cancellationToken)
            .ConfigureAwait(false);
        var decided = CourtProblems.From(outcome);
        return decided.IsSuccess
            ? Result<(AppendCourtEventsResponse, int, bool), CourtProblem>.Success(
                (new AppendCourtEventsResponse(decided.Value.LastSequence, decided.Value.NewEvents.Length),
                    decided.Value.Duplicates,
                    decided.Value.NewEvents.Any(item => ResultChangingTypes.Contains(item.Envelope.Type))))
            : Refuse(decided.Error);
    }

    /// <summary>The member ids the request names that belong to the group, in one query (ADR 0060, D11).</summary>
    private async Task<CourtWriteContext> ContextAsync(CourtAccess access, CourtWriteRequest request, CancellationToken cancellationToken)
    {
        ImmutableArray<Guid> named = [.. CourtEventMembers.Collect(request.Events.Select(item => item.Envelope))
            .Select(text => Guid.TryParse(text, out var id) ? id : (Guid?)null)
            .OfType<Guid>()
            .Distinct()];
        var members = await membership.FindMembersOfGroupAsync(access.GroupId, named, cancellationToken).ConfigureAwait(false);
        return new CourtWriteContext(
            Text(access.MemberId),
            [.. members.Select(Text)],
            SupportedVersions.RulesVersions,
            SupportedVersions.FormationsVersions);
    }

    private static Result<(AppendCourtEventsResponse Response, int Duplicates, bool ChangesResults), CourtProblem> Refuse(CourtProblem problem) =>
        Result<(AppendCourtEventsResponse, int, bool), CourtProblem>.Failure(problem);

    /// <summary>The lowercase 8-4-4-4-12 form the envelope parser accepts.</summary>
    private static string Text(Guid id) => id.ToString("D");
}
