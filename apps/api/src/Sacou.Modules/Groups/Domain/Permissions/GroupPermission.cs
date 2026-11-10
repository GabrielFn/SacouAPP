namespace Sacou.Modules.Groups.Domain.Permissions;

/// <summary>What a role may do in its group. Each group route declares exactly one (ADR 0040, docs/dominio/grupos.md).</summary>
internal enum GroupPermission
{
    ViewGroup,
    RenameGroup,
    ManageInvites,
    ChangeMemberType,
    AssignBasicRole,
    AssignAdminRole,
    RemoveMember,
    RemoveAdmin,
    Leave,
    ManageSettings,
}
