using Microsoft.AspNetCore.Http;
using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Stats.Access;

/// <summary>
/// What <see cref="StatsAccessFilter"/> proved: the caller is an active member of the group in the route, with a role
/// that holds the endpoint's capability, read from the database on every request.
/// </summary>
internal sealed record StatsAccess(Guid GroupId, Guid UserId, Guid MemberId, GroupRole Role)
{
    /// <summary>Never the member id: it does not go to a log.</summary>
    public override string ToString() => nameof(StatsAccess);
}

internal static class StatsAccessHttpContextExtensions
{
    /// <summary>Only inside a stats route: the filter sets it before the handler runs.</summary>
    public static StatsAccess StatsAccess(this HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return context.Features.Get<StatsAccess>()
            ?? throw new InvalidOperationException("A stats handler ran without the stats access filter.");
    }
}
