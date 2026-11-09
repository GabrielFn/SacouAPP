namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>One role per member. <see cref="Scorekeeper"/> is "Placar"; <see cref="Player"/> is "Jogador". Not <c>PlayerRole</c>, the court function.</summary>
internal enum GroupRole
{
    Admin,
    CoAdmin,
    Scorekeeper,
    Player,
}
