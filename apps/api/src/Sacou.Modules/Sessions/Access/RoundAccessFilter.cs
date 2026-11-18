using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
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
        var capability = Declared<RoundCapabilityMetadata>(http).Capability;
        var cancellationToken = http.RequestAborted;
        var user = await http.RequestServices.GetRequiredService<ICurrentUser>().GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<RoundAccess>(user.Error);
        }

        var authorized = await http.RequestServices.GetRequiredService<IGroupMembership>()
            .AuthorizeAsync(http.Request.RouteValues[GroupIdRouteValue], user.Value.UserId, capability, cancellationToken)
            .ConfigureAwait(false);
        if (authorized.IsFailure)
        {
            return Result.Failure<RoundAccess>(authorized.Error);
        }

        var (id, member) = authorized.Value;
        return Result.Success(new RoundAccess(new GroupId(id), user.Value.UserId, new MemberId(member.MemberId), member.Role, member.Type));
    }
}
