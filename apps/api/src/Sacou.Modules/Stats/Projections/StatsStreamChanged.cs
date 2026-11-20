using Sacou.Modules.Matches.Contracts;

namespace Sacou.Modules.Stats.Projections;

/// <summary>After a write that finished or undid a match, the group is refreshed at once (ADR 0071, 3.9 a).</summary>
internal sealed class StatsStreamChanged(StatsProjector projector) : ICourtStreamChanged
{
    public Task CourtStreamChangedAsync(Guid groupId, Guid roundId, Guid courtSessionId, CancellationToken cancellationToken) =>
        projector.GetGroupAsync(groupId, cancellationToken);
}
