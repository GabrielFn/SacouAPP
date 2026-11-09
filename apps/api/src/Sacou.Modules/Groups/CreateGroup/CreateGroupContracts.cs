namespace Sacou.Modules.Groups.CreateGroup;

/// <summary>Only the name: a field the record does not declare is a 400 (ADR 0039).</summary>
internal sealed record CreateGroupRequest(string? Name);

internal sealed record CreateGroupResponse(Guid GroupId, Guid MemberId);
