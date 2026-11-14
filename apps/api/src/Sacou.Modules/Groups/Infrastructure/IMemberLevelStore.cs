using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Levels;
using Sacou.Modules.Groups.Domain.Members;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>A member of the group and the admin's level row for it, if any, for the level contract (ADR 0051, D9).</summary>
internal sealed record MemberLevelInput(MemberId MemberId, UserId? UserId, MemberLevel? Level);

/// <summary>
/// Where the admin's levels live. Every read goes by the group id of the route, and a member by
/// <c>(group_id, member_id)</c>: never a bare id (ADR 0040, D7).
/// </summary>
internal interface IMemberLevelStore
{
    /// <summary>Every level row of the group, of active members or not.</summary>
    Task<IReadOnlyList<MemberLevel>> ListAsync(GroupId group, CancellationToken cancellationToken);

    /// <summary>The members of <paramref name="members"/> that belong to the group, any status, with their level row; the others are absent.</summary>
    Task<IReadOnlyList<MemberLevelInput>> FindInputsAsync(GroupId group, IReadOnlyCollection<MemberId> members, CancellationToken cancellationToken);

    /// <summary>
    /// Every level write (ADR 0051, D10): one transaction that starts with <c>SELECT ... FOR UPDATE</c> on the group
    /// row (the lock of every member write, ADR 0040 D8), reads the group's members, applies <paramref name="change"/>
    /// and upserts every level it returns. A demotion or removal that lands after the access filter is seen here. A
    /// missing group is <c>groups.group-not-found</c>; a failed change writes nothing.
    /// </summary>
    Task<Result<MemberLevelChange>> ExecuteInGroupLockAsync(
        GroupId group, Func<MemberLevelContext, Result<MemberLevelChange>> change, CancellationToken cancellationToken);
}
