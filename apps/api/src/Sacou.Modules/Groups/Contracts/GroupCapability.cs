namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// What another module asks of a member's role, by name. The table itself stays in the Groups domain
/// (<c>RolePermissions</c>); <see cref="IGroupMembership.Allows"/> reads it, so nothing is copied (ADR 0043).
/// </summary>
public enum GroupCapability
{
    ViewGroup,
    ManageRounds,
    RespondAttendance,
}
