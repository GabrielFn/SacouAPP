
namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// Read-only membership lookup for the other modules (E3.3 onwards: "only an admin edits the settings").
/// Ids travel as <see cref="Guid"/>; each module wraps them in its own value object (ADR 0040).
/// </summary>
public interface IGroupMembership
{
    /// <summary>The person's active membership in the group, or null for a non-member, a left or a removed member.</summary>
    Task<GroupMembership?> FindActiveAsync(Guid groupId, Guid userId, CancellationToken cancellationToken);

    /// <summary>Every active member of the group, in the order they joined; empty for a group that does not exist.</summary>
    Task<IReadOnlyList<GroupMembership>> ListActiveAsync(Guid groupId, CancellationToken cancellationToken);

    /// <summary>
    /// Every member id the person has or had, in any group and any status (active, left, removed), oldest first:
    /// the personal data export reads the attendances of all of them (E3.16, ADR 0056, D6).
    /// </summary>
    Task<IReadOnlyList<Guid>> ListMemberIdsOfUserAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>
    /// The ids among <paramref name="memberIds"/> that are members of the group, in any status (active, left,
    /// removed, guest), in one query: a member id is never deleted (ADR 0012), so the answer never changes
    /// for an id once it is a member (ADR 0060, D11). Empty for a group that does not exist.
    /// </summary>
    Task<IReadOnlySet<Guid>> FindMembersOfGroupAsync(Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken);

    /// <summary>Whether the role may do it, read from the single permission table of the Groups domain.</summary>
    bool Allows(GroupRole role, GroupCapability capability);
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
