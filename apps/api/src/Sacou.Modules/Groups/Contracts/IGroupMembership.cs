
namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// Read-only membership lookup for the other modules (E3.3 onwards: "only an admin edits the settings").
/// Ids travel as <see cref="Guid"/>; each module wraps them in its own value object (ADR 0040).
/// </summary>
public interface IGroupMembership
{
    /// <summary>The person's active membership in the group, or null for a non-member, a left or a removed member.</summary>
    Task<GroupMembership?> FindActiveAsync(Guid groupId, Guid userId, CancellationToken cancellationToken);
}

public sealed record GroupMembership(Guid MemberId, GroupRole Role, MemberType Type);

/// <summary>Mirrors the domain role, converted by hand: the domain enum stays internal.</summary>
public enum GroupRole
{
    Admin,
    CoAdmin,
    Scorekeeper,
    Player,
}

/// <summary>Mensalista (<see cref="Regular"/>) or avulso (<see cref="DropIn"/>).</summary>
public enum MemberType
{
    Regular,
    DropIn,
}
