using Sacou.Modules.Groups.Domain.Permissions;

namespace Sacou.Modules.Groups.Access;

/// <summary>The one permission a group endpoint requires. More or fewer than one is a 500 and a failing route guard test.</summary>
internal sealed record GroupPermissionMetadata(GroupPermission Permission);

/// <summary>Added with the filter, by the same call, so the route guard test can see that the filter is there.</summary>
internal sealed class GroupAccessFilterMetadata
{
    public static readonly GroupAccessFilterMetadata Instance = new();

    private GroupAccessFilterMetadata()
    {
    }
}
