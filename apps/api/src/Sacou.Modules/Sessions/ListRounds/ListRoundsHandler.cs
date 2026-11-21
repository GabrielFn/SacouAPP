using Sacou.Modules.Sessions.Access;
using Sacou.Modules.Sessions.Application;
using Sacou.Modules.Sessions.Domain;
using Sacou.Modules.Sessions.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.ListRounds;

/// <summary>
/// The upcoming rounds and those still inside the summary card window, soonest first (tela 06). A read that first makes the next
/// occurrence of every active series (idempotent, ADR 0043, D3).
/// </summary>
internal sealed class ListRoundsHandler(IRoundStore store, RoundMaterializer materializer, GroupRoundContext groups, TimeProvider time)
{
    private const int SummaryCardWindowHours = 24;

    /// <summary>Counted from the start, so it covers the longest round (the automatic end) plus the 24 h of the summary card; the app trims it by <c>endsAt</c>.</summary>
    private static readonly TimeSpan RecentWindow = TimeSpan.FromHours(SessionLimits.RoundAutoEndHours + SummaryCardWindowHours);

    public async Task<Result<IReadOnlyList<RoundSummaryResponse>>> HandleAsync(RoundAccess access, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(access);
        await materializer.EnsureUpcomingAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        var rounds = await store.ListFromAsync(access.GroupId, time.GetUtcNow() - RecentWindow, cancellationToken).ConfigureAwait(false);
        var state = await groups.LoadAsync(access.GroupId, cancellationToken).ConfigureAwait(false);
        if (state.IsFailure)
        {
            return Result.Failure<IReadOnlyList<RoundSummaryResponse>>(state.Error);
        }

        IReadOnlyList<RoundSummaryResponse> summaries =
            [.. rounds.Select(round => RoundSummaryResponse.From(round, state.Value.ResolveStored(round), access.MemberId))];
        return Result.Success(summaries);
    }
}
