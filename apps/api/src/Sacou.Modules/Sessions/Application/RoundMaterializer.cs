using Microsoft.Extensions.Logging;
using Sacou.Modules.Sessions.Domain.Attendances;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Modules.Sessions.Domain.Series;
using Sacou.Modules.Sessions.Domain.Time;
using Sacou.Modules.Sessions.Infrastructure;

namespace Sacou.Modules.Sessions.Application;

/// <summary>
/// Makes the next occurrence of every active series of a group, on read and idempotently (ADR 0043, D3):
/// the domain says which date, the unique index <c>(series_id, local_date)</c> says who made it, and the
/// mensalistas are seeded only by the call whose insert won. No timer and no job: the job of E3.11 will call this same code.
/// </summary>
internal sealed class RoundMaterializer(
    IRoundStore store, GroupRoundContext groups, TimeProvider time, ILogger<RoundMaterializer> logger)
{
    /// <summary>Occurrences older than this cannot matter: the next one is always after today.</summary>
    private const int LookBackDays = 14;

    public async Task EnsureUpcomingAsync(GroupId group, CancellationToken cancellationToken)
    {
        var series = await store.ListActiveSeriesAsync(group, cancellationToken).ConfigureAwait(false);
        if (series.Count == 0)
        {
            return;
        }

        var now = time.GetUtcNow();
        var since = SessionsTime.LocalDateOf(now, SessionsTime.TimeZone).AddDays(-LookBackDays);
        var occurrences = await store.ListOccurrencesAsync([.. series.Select(item => item.Id)], since, cancellationToken).ConfigureAwait(false);
        foreach (var item in series)
        {
            if (RoundSchedule.NextOccurrence(item, occurrences[item.Id], now) is { } date)
            {
                await MaterializeAsync(item, date, now, cancellationToken).ConfigureAwait(false);
            }
        }
    }

    private async Task MaterializeAsync(RoundSeries series, DateOnly date, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var state = await groups.LoadAsync(series.GroupId, cancellationToken).ConfigureAwait(false);
        if (state.IsFailure)
        {
            return;
        }

        var resolved = state.Value.ResolveRequested(null);
        var created = series.Occur(RoundId.New(now), date);
        var seeded = resolved.IsSuccess
            ? created.Then(round => RoundReconciliation.SeedRegulars(round, resolved.Value.Rules, state.Value.RegularsInJoinOrder(), now))
            : created;
        var added = await store.AddAsync(new NewRound(seeded, NewSeries: null, now, EnforceLimits: false), cancellationToken).ConfigureAwait(false);
        if (added is { IsSuccess: true, Value: true })
        {
            RoundLog.Materialized(logger, series.GroupId.Value, seeded.Round.Id.Value, series.Id.Value);
        }
    }
}
