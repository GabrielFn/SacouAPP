using Microsoft.AspNetCore.Http;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Shared.Results;

namespace Sacou.Modules.Matches.Access;

/// <summary>
/// Secure by default for every route under <c>/v1/groups/{groupId}</c> that the Matches maps, with the very same
/// answers as the Groups and Sessions filters, built from <see cref="GroupAccessErrors"/>: a person without a user
/// row gets 403 <c>identity.user-not-registered</c>; a non-member, or a member who left or was removed, gets the same
/// 404 as a group that does not exist; a member whose role lacks the capability gets 403 <c>groups.forbidden</c>.
/// The role comes from the database on every request (ADR 0060, D5).
/// </summary>
internal sealed class CourtAccessFilter : AccessFilter<CourtAccess>
{
    public const string GroupIdRouteValue = "groupId";

    protected override async Task<Result<CourtAccess>> ResolveAsync(HttpContext http)
    {
        var authorized = await http.RequestServices.AuthorizeGroupMemberAsync(
            http.Request.RouteValues[GroupIdRouteValue],
            Declared<CourtCapabilityMetadata>(http).Capability,
            http.RequestAborted).ConfigureAwait(false);
        return authorized.Match(
            access => Result.Success(new CourtAccess(access.GroupId, access.Membership.MemberId, access.Membership.Role)),
            Result.Failure<CourtAccess>);
    }
}
