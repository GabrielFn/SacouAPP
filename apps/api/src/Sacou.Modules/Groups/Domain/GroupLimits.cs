using Sacou.Modules.Groups.Domain.Groups;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain;

/// <summary>
/// Ceilings against abuse (ADR 0040). No pilot group comes close; the numbers are reviewed with the rate
/// limits in E5.3.
/// </summary>
internal static class GroupLimits
{
    public const int MaxActiveMembersPerGroup = 300;
    public const int MaxActiveGroupsPerPerson = 100;
    public const int MaxActiveInvitesPerGroup = 20;

    /// <summary>Whether a person already active in <paramref name="activeGroups"/> groups may create or join one more.</summary>
    public static Result CanJoinAnotherGroup(int activeGroups) =>
        activeGroups < MaxActiveGroupsPerPerson ? Result.Success() : Result.Failure(GroupErrors.MembershipLimit);

    /// <summary>Whether a group with <paramref name="activeMembers"/> active members may take one more.</summary>
    public static Result CanTakeAnotherMember(int activeMembers) =>
        activeMembers < MaxActiveMembersPerGroup ? Result.Success() : Result.Failure(GroupErrors.MemberLimit);
}
