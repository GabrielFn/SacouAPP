namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>A row of <c>groups.groups</c>. Persistence shape only: the domain never sees it (ADR 0040, D6).</summary>
internal sealed class GroupRow
{
    public required Guid Id { get; init; }

    public required string Name { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }
}

/// <summary>A row of <c>groups.members</c>. Enums as text, kept stable by <see cref="ColumnValues"/>.</summary>
internal sealed class MemberRow
{
    public required Guid Id { get; init; }

    public required Guid GroupId { get; init; }

    public Guid? UserId { get; init; }

    public required string Role { get; init; }

    public required string MemberType { get; init; }

    public required string Status { get; init; }

    public required DateTimeOffset JoinedAt { get; init; }

    public DateTimeOffset? LeftAt { get; init; }
}

/// <summary>A row of <c>groups.invites</c>: only the SHA-256 of the token, never the token (ADR 0040, D10).</summary>
internal sealed class InviteRow
{
    public required Guid Id { get; init; }

    public required Guid GroupId { get; init; }

    public required byte[] TokenHash { get; init; }

    public required Guid CreatedByMemberId { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? ExpiresAt { get; init; }

    public DateTimeOffset? RevokedAt { get; init; }

    public int UseCount { get; init; }
}
