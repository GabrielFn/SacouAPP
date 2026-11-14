namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>A row of <c>groups.guests</c>: the name and position of a member without an account (ADR 0053, D2). No author.</summary>
internal sealed class GuestRow
{
    public required Guid MemberId { get; init; }

    public required Guid GroupId { get; init; }

    public required string Name { get; init; }

    public string? PrimaryPosition { get; init; }

    public required Guid RequestId { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }
}
