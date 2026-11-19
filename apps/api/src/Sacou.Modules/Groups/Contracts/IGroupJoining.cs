using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The way into a group that another module opens: the link of a round puts whoever is not in the group yet in it
/// as a player and an avulso (E3.12, ADR 0070, D2), with the rules and locks of the invite acceptance (ADR 0040, D10).
/// </summary>
public interface IGroupJoining
{
    /// <summary>
    /// In its own committed transaction: the group lock, the person lock, the check that the account still exists
    /// (ADR 0056, D7a), then the rule. Already active: a success with <see cref="JoinedMember.Joined"/> false. Removed:
    /// <c>groups.member-removed</c> (403). The ceilings: 409. A missing group: <c>groups.group-not-found</c>.
    /// </summary>
    Task<Result<JoinedMember>> JoinAsDropInAsync(Guid groupId, Guid userId, CancellationToken cancellationToken);
}

/// <summary>The person's member in the group, and whether this call put them there.</summary>
public sealed record JoinedMember(Guid MemberId, bool Joined);
