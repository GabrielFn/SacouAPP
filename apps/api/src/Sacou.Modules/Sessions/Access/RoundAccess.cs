using Microsoft.AspNetCore.Http;
using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Domain.Rounds;
using Sacou.Shared.Members;

namespace Sacou.Modules.Sessions.Access;

/// <summary>
/// What <see cref="RoundAccessFilter"/> proved: the caller is an active member of the group in the route,
/// with a role that holds the endpoint's capability. Read from the database on every request.
/// <paramref name="UserId"/> is kept to ask the Groups again, under the round's lock, whether the caller still may.
/// </summary>
internal sealed record RoundAccess(GroupId GroupId, Guid UserId, MemberId MemberId, GroupRole Role, MemberType Type);

internal static class RoundAccessHttpContextExtensions
{
    /// <summary>Only inside a round route: the filter sets it before the handler runs.</summary>
    public static RoundAccess RoundAccess(this HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return context.Features.Get<RoundAccess>()
            ?? throw new InvalidOperationException("A round handler ran without the round access filter.");
    }
}
