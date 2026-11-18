using Microsoft.AspNetCore.Http;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;
using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Access;

/// <summary>
/// Secure by default for every route under <c>/v1/groups/{groupId}</c> that the Sessions maps (ADR 0040, D3;
/// ADR 0043, D9), with the very same answers as the Groups filter, built from <see cref="GroupAccessErrors"/>:
/// a person without a user row gets 403 <c>identity.user-not-registered</c>; a non-member, or a member who left
/// or was removed, gets the same 404 as a group that does not exist; a member whose role lacks the endpoint's
/// capability gets 403 <c>groups.forbidden</c>. The role comes from the database on every request.
/// </summary>
internal sealed class RoundAccessFilter : AccessFilter<RoundAccess>
{
    public const string GroupIdRouteValue = "groupId";

    protected override async Task<Result<RoundAccess>> ResolveAsync(HttpContext http)
    {
        var authorized = await http.RequestServices.AuthorizeGroupMemberAsync(
            http.Request.RouteValues[GroupIdRouteValue],
            Declared<RoundCapabilityMetadata>(http).Capability,
            http.RequestAborted).ConfigureAwait(false);
        return authorized.Match(
            access => Result.Success(new RoundAccess(new GroupId(access.GroupId), access.UserId, new MemberId(access.Membership.MemberId), access.Membership.Role, access.Membership.Type)),
            Result.Failure<RoundAccess>);
    }
}
