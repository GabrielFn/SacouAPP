using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>The group id from the route and the person's active membership, already allowed to do the capability.</summary>
public sealed record AuthorizedMember(Guid GroupId, GroupMembership Membership);

/// <summary>
/// The answers every access filter outside the Groups gives, built from <see cref="GroupAccessErrors"/> (ADR 0043, D9;
/// ADR 0060, D5): a group id that is not one, a non-member, or a member who left or was removed get the same 404 as a
/// group that does not exist; a member whose role lacks the capability gets 403 <c>groups.forbidden</c>.
/// </summary>
public static class GroupMembershipAuthorization
{
    public static async Task<Result<AuthorizedMember>> AuthorizeAsync(
        this IGroupMembership groups,
        object? routeGroupId,
        Guid userId,
        GroupCapability capability,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(routeGroupId as string, out var groupId))
        {
            return Result.Failure<AuthorizedMember>(GroupAccessErrors.GroupNotFound);
        }

        var member = await groups.FindActiveAsync(groupId, userId, cancellationToken).ConfigureAwait(false);
        if (member is null)
        {
            return Result.Failure<AuthorizedMember>(GroupAccessErrors.GroupNotFound);
        }

        return groups.Allows(member.Role, capability)
            ? Result.Success(new AuthorizedMember(groupId, member))
            : Result.Failure<AuthorizedMember>(GroupAccessErrors.Forbidden);
    }
}
