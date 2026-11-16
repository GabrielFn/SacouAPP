using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// Settings of a group for the other modules (ADR 0041 D6, ADR 0043). The round keeps only its layer; the
/// group is read at every use, so changing "Como jogamos" reaches the rounds that did not override a leaf.
/// </summary>
public interface IGroupSettingsReader
{
    /// <summary>The group's settings, or null when the group does not exist.</summary>
    Task<GroupSettingsSnapshot?> GetAsync(Guid groupId, CancellationToken cancellationToken);

    /// <summary>
    /// Validates the round layer (level <c>round</c>), normalizes it against the group (a leaf equal to the group's
    /// goes away; an empty layer becomes null), resolves it and types the attendance rules. A refusal is
    /// <c>groups.settings-invalid</c>, never with the path.
    /// </summary>
    Result<RoundSettings> ResolveRound(GroupSettingsSnapshot group, string? roundLayerJson);
}

/// <summary>
/// <see cref="LayerJson"/> is what the round stores (null when it inherits everything); <see cref="ResolvedJson"/>
/// is the complete document for the screen; <see cref="Sources"/> says, by leaf path, whether it came from the
/// <c>group</c> or the <c>round</c>. <see cref="Attendance"/> and <see cref="Draw"/> are the typed leaves the Sessions uses.
/// </summary>
public sealed record RoundSettings(
    string? LayerJson, string ResolvedJson, IReadOnlyDictionary<string, string> Sources, AttendanceRules Attendance, DrawRules Draw);
