using Microsoft.Extensions.DependencyInjection;
using Sacou.Modules.Identity.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>The group id from the route, the person and their active membership, already allowed to do the capability.</summary>
public sealed record AuthorizedMember(Guid GroupId, Guid UserId, GroupMembership Membership);

/// <summary>
/// The answers every access filter outside the Groups gives, built from <see cref="GroupAccessErrors"/> (ADR 0043, D9;
/// ADR 0060, D5): a person without a user row gets 403 <c>identity.user-not-registered</c>; a group id that is not one, a non-member, or a member who left or was removed get the same 404 as a
/// group that does not exist; a member whose role lacks the capability gets 403 <c>groups.forbidden</c>.
/// </summary>
public static class GroupMembershipAuthorization
{
    /// <summary>Resolves both services from the request's scope, the way an endpoint filter reads them.</summary>
    public static Task<Result<AuthorizedMember>> AuthorizeGroupMemberAsync(
        this IServiceProvider services,
        object? routeGroupId,
        GroupCapability capability,
        CancellationToken cancellationToken) =>
        services.GetRequiredService<IGroupMembership>()
            .AuthorizeAsync(services.GetRequiredService<ICurrentUser>(), routeGroupId, capability, cancellationToken);

    public static async Task<Result<AuthorizedMember>> AuthorizeAsync(
        this IGroupMembership groups,
        ICurrentUser currentUser,
        object? routeGroupId,
        GroupCapability capability,
        CancellationToken cancellationToken)
    {
        var user = await currentUser.GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<AuthorizedMember>(user.Error);
        }

        if (!Guid.TryParse(routeGroupId as string, out var groupId))
        {
            return Result.Failure<AuthorizedMember>(GroupAccessErrors.GroupNotFound);
        }

        var member = await groups.FindActiveAsync(groupId, user.Value.UserId, cancellationToken).ConfigureAwait(false);
        if (member is null)
        {
            return Result.Failure<AuthorizedMember>(GroupAccessErrors.GroupNotFound);
        }

        return groups.Allows(member.Role, capability)
            ? Result.Success(new AuthorizedMember(groupId, user.Value.UserId, member))
            : Result.Failure<AuthorizedMember>(GroupAccessErrors.Forbidden);
    }
}
