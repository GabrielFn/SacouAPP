using Microsoft.AspNetCore.Http;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Stats.Access;

/// <summary>
/// Secure by default for every route under <c>/v1/groups/{groupId}</c> that the Stats maps, with the very same answers
/// as the other filters, built from <see cref="GroupAccessErrors"/>: a person without a user row gets 403
/// <c>identity.user-not-registered</c>; a non-member, or a member who left or was removed, gets the same 404 as a group
/// that does not exist; a member whose role lacks the capability gets 403 <c>groups.forbidden</c>.
/// </summary>
internal sealed class StatsAccessFilter : AccessFilter<StatsAccess>
{
    public const string GroupIdRouteValue = "groupId";

    protected override async Task<Result<StatsAccess>> ResolveAsync(HttpContext http)
    {
        var authorized = await http.RequestServices.AuthorizeGroupMemberAsync(
            http.Request.RouteValues[GroupIdRouteValue],
            Declared<StatsCapabilityMetadata>(http).Capability,
            http.RequestAborted).ConfigureAwait(false);
        return authorized.Match(
            access => Result.Success(new StatsAccess(access.GroupId, access.UserId, access.Membership.MemberId, access.Membership.Role)),
            Result.Failure<StatsAccess>);
    }
}
