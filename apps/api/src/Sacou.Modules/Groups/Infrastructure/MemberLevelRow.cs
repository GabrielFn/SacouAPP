namespace Sacou.Modules.Groups.Infrastructure;

/// <summary>A row of <c>groups.member_levels</c>: five columns, the author only by member id (ADR 0051, D2).</summary>
internal sealed class MemberLevelRow
{
    public required Guid MemberId { get; init; }

    public required Guid GroupId { get; init; }

    public short? LevelTenths { get; init; }

    public required Guid SetByMemberId { get; init; }

    public required DateTimeOffset SetAt { get; init; }
}
