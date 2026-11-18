using Microsoft.AspNetCore.Http;
using Sacou.Modules.Groups.Contracts;

namespace Sacou.Modules.Matches.Access;

/// <summary>
/// What <see cref="CourtAccessFilter"/> proved: the caller is an active member of the group in the route, with a
/// role that holds the endpoint's capability. Read from the database on every request (ADR 0060, D5); the user id lets
/// a takeover ask again under the stream's lock (ADR 0063, D4).
/// </summary>
internal sealed record CourtAccess(Guid GroupId, Guid UserId, Guid MemberId, GroupRole Role)
{
    /// <summary>Never the member id: it does not go to a log (ADR 0060, D15).</summary>
    public override string ToString() => nameof(CourtAccess);
}

internal static class CourtAccessHttpContextExtensions
{
    /// <summary>Only inside a court route: the filter sets it before the handler runs.</summary>
    public static CourtAccess CourtAccess(this HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return context.Features.Get<CourtAccess>()
            ?? throw new InvalidOperationException("A court handler ran without the court access filter.");
    }
}
