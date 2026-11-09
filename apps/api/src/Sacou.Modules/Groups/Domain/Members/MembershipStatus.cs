namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>A member row is never deleted: <see cref="Left"/> and <see cref="Removed"/> are non-members for every group route.</summary>
internal enum MembershipStatus
{
    Active,
    Left,
    Removed,
}
