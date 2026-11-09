namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>One role per member. <see cref="Scorekeeper"/> is "Placar"; <see cref="Player"/> is "Jogador". Not <c>PlayerRole</c>, the court function.</summary>
internal enum GroupRole
{
    Admin,
    CoAdmin,
    Scorekeeper,
    Player,
}

internal static class GroupRoleExtensions
{
    /// <summary>Admin and co-admin: only an admin gives, takes or removes them (Gabriel, question 16).</summary>
    public static bool IsAdministrative(this GroupRole role) => role is GroupRole.Admin or GroupRole.CoAdmin;
}
