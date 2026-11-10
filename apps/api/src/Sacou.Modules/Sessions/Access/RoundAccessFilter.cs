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
internal sealed class RoundAccessFilter : IEndpointFilter
{
    public const string GroupIdRouteValue = "groupId";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(next);
        var http = context.HttpContext;
        var access = await ResolveAsync(http, RequiredCapability(http)).ConfigureAwait(false);
        if (access.IsFailure)
        {
            return ProblemResults.From(access.Error);
        }

        http.Features.Set(access.Value);
        return await next(context).ConfigureAwait(false);
    }

    /// <summary>Fails closed: an endpoint that does not declare exactly one capability never runs.</summary>
    private static GroupCapability RequiredCapability(HttpContext http)
    {
        var declared = http.GetEndpoint()?.Metadata.GetOrderedMetadata<RoundCapabilityMetadata>() ?? [];
        return declared.Count == 1
            ? declared[0].Capability
            : throw new InvalidOperationException("A round endpoint must declare exactly one capability.");
    }

    private static async Task<Result<RoundAccess>> ResolveAsync(HttpContext http, GroupCapability capability)
    {
        var cancellationToken = http.RequestAborted;
        var user = await http.RequestServices.GetRequiredService<ICurrentUser>().GetAsync(cancellationToken).ConfigureAwait(false);
        if (user.IsFailure)
        {
            return Result.Failure<RoundAccess>(user.Error);
        }

        if (!Guid.TryParse(http.Request.RouteValues[GroupIdRouteValue] as string, out var id))
        {
            return Result.Failure<RoundAccess>(GroupAccessErrors.GroupNotFound);
        }

        var groups = http.RequestServices.GetRequiredService<IGroupMembership>();
        var member = await groups.FindActiveAsync(id, user.Value.UserId, cancellationToken).ConfigureAwait(false);
        if (member is null)
        {
            return Result.Failure<RoundAccess>(GroupAccessErrors.GroupNotFound);
        }

        return groups.Allows(member.Role, capability)
            ? Result.Success(new RoundAccess(new GroupId(id), user.Value.UserId, new MemberId(member.MemberId), member.Role, member.Type))
            : Result.Failure<RoundAccess>(GroupAccessErrors.Forbidden);
    }
}
