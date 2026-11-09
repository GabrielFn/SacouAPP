namespace Sacou.Modules.Groups.Domain.Members;

/// <summary>
/// One per person per group, for ever: whoever leaves and comes back keeps it, and so keeps the history.
/// Events point here, never to a user (ADR 0012). Other modules receive it as a <see cref="Guid"/> (ADR 0040).
/// </summary>
internal readonly record struct MemberId(Guid Value)
{
    public static MemberId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));
}
