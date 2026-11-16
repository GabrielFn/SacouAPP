using Sacou.Modules.Identity.Contracts;

namespace Sacou.Modules.Identity.GetDeletionBlockers;

/// <summary>The body of <c>GET /v1/me/deletion-blockers</c>, ordered by group name, then id.</summary>
internal sealed record DeletionBlockersResponse(IReadOnlyList<DeletionBlockerResponse> Blockers)
{
    public static DeletionBlockersResponse From(IEnumerable<DeletionBlocker> blockers) => new(
        [.. blockers
            .OrderBy(blocker => blocker.GroupName, StringComparer.Ordinal).ThenBy(blocker => blocker.GroupId)
            .Select(blocker => new DeletionBlockerResponse(blocker.GroupId, blocker.GroupName, blocker.Kind))]);
}

/// <summary>One group to hand over: <c>lastAdmin</c> means "promote someone to admin first" (screen 19).</summary>
internal sealed record DeletionBlockerResponse(Guid GroupId, string GroupName, DeletionBlockerKind Kind);
