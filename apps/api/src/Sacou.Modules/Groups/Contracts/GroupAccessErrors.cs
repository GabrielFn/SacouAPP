using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The two answers of every group route's access filter, public so another module's filter (the Sessions)
/// answers with the very same codes and bodies instead of a copy (ADR 0040, D4; ADR 0043).
/// </summary>
public static class GroupAccessErrors
{
    /// <summary>A non-member, a member who left or was removed, and a group that does not exist look the same.</summary>
    public static readonly Error GroupNotFound = new("groups.group-not-found", ErrorKind.NotFound);

    public static readonly Error Forbidden = new("groups.forbidden", ErrorKind.Forbidden);

    /// <summary>A settings layer another module received and the Groups rules refuse (the same code and text as the Groups' own settings routes).</summary>
    public static readonly Error SettingsInvalid = new("groups.settings-invalid", ErrorKind.Validation);
}
