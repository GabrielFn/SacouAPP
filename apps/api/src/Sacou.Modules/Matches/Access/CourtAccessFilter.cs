using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Sacou.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Identity.Contracts;
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
        var capability = Declared<CourtCapabilityMetadata>(http).Capability;
        var cancellationToken = http.RequestAborted;
        var user = await http.RequestServices.GetRequiredService<ICurrentUser>().GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<CourtAccess>(user.Error);
        }

        var authorized = await http.RequestServices.GetRequiredService<IGroupMembership>()
            .AuthorizeAsync(http.Request.RouteValues[GroupIdRouteValue], user.Value.UserId, capability, cancellationToken)
            .ConfigureAwait(false);
        if (authorized.IsFailure)
        {
            return Result.Failure<CourtAccess>(authorized.Error);
        }

        var (id, member) = authorized.Value;
        return Result.Success(new CourtAccess(id, member.MemberId, member.Role));
    }
}
