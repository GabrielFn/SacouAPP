
using System.Text.Json;

namespace Sacou.Modules.Groups.CreateGroup;

/// <summary>The name and, optionally, a ready-made template key ("do-zero" without it) and a partial settings layer (day, time, venue...) saved with the group in the same transaction. A field the record does not declare is a 400 (ADR 0039).</summary>
internal sealed record CreateGroupRequest(string? Name, string? TemplateKey = null, JsonElement? Settings = null);

internal sealed record CreateGroupResponse(Guid GroupId, Guid MemberId);
