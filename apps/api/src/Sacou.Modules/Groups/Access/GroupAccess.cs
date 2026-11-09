using Microsoft.AspNetCore.Http;
using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Access;

/// <summary>
/// What <see cref="GroupAccessFilter"/> proved: the caller is an active member of the group in the route,
/// with a role that holds the endpoint's permission. Read from the database on every request.
/// </summary>
internal sealed record GroupAccess(GroupId GroupId, GroupMember Member);

internal static class GroupAccessHttpContextExtensions
{
    /// <summary>Only inside a group route: the filter sets it before the handler runs.</summary>
    public static GroupAccess GroupAccess(this HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return context.Features.Get<GroupAccess>()
            ?? throw new InvalidOperationException("A group handler ran without the group access filter.");
    }
}
