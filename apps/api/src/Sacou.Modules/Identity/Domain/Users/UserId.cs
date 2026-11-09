namespace Sacou.Modules.Identity.Domain.Users;

/// <summary>
/// The internal identity of a person with an account. Never the Firebase UID, and never in events:
/// those point to <c>MemberId</c> (ADR 0012, ADR 0036).
/// </summary>
internal readonly record struct UserId(Guid Value)
{
    /// <summary>UUID v7, so ids sort by creation. The clock comes from the caller.</summary>
    public static UserId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));
}
