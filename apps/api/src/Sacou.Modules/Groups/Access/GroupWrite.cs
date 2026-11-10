using Sacou.Shared.Members;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Sacou.Http;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Infrastructure;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Access;

/// <summary>
/// The one shape of a member write (ADR 0040, D8): the change runs on the aggregate loaded under the group
/// lock, with the caller's <see cref="MemberId"/> from the access filter. The caller's role is judged again
/// there, in the same transaction, so a demotion between the filter and the lock wins.
/// </summary>
internal static class GroupWrite
{
    public static async Task<Results<TSuccess, ProblemHttpResult>> ExecuteAsync<TSuccess>(
        HttpContext context,
        IGroupStore store,
        Func<Group, MemberId, Result<GroupChange>> change,
        Func<TSuccess> onSuccess,
        CancellationToken cancellationToken)
        where TSuccess : IResult
    {
        ArgumentNullException.ThrowIfNull(store);
        ArgumentNullException.ThrowIfNull(change);
        ArgumentNullException.ThrowIfNull(onSuccess);
        var access = context.GroupAccess();
        var changed = await store.ExecuteInGroupLockAsync(access.GroupId, group => change(group, access.Member.Id), cancellationToken)
            .ConfigureAwait(false);
        return changed.ToHttpResult(_ => onSuccess());
    }
}
