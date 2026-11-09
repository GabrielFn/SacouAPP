using Sacou.Shared.Results;

namespace Sacou.Modules.Groups.Domain.Groups;

/// <summary>Stable codes, listed in docs/dominio/grupos.md. The app maps each one to its pt-BR text.</summary>
internal static class GroupErrors
{
    public static readonly Error NameInvalid = new("groups.name-invalid", ErrorKind.Validation);

    /// <summary>Also what a non-member gets, byte for byte: the group's existence is never confirmed (ADR 0040).</summary>
    public static readonly Error GroupNotFound = new("groups.group-not-found", ErrorKind.NotFound);

    /// <summary>Only for members, who already know the group exists.</summary>
    public static readonly Error Forbidden = new("groups.forbidden", ErrorKind.Forbidden);

    public static readonly Error MembershipLimit = new("groups.membership-limit", ErrorKind.Conflict);

    public static readonly Error MemberLimit = new("groups.member-limit", ErrorKind.Conflict);
}
