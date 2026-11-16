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
    ManageRounds,
    RespondAttendance,

    /// <summary>Reads and writes the admin's private level of each member (ADR 0047, ADR 0051 D8).</summary>
    ManageMemberLevels,

    /// <summary>Adds a guest without an account and corrects its name and position (ADR 0053, D7).</summary>
    ManageGuests,

    /// <summary>Draws the teams of a round with the private levels (ADR 0055): the answer carries them.</summary>
    DrawTeams,
}
