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

    /// <summary>The target is not an active member of this group: missing, left, removed or from another group look the same.</summary>
    public static readonly Error MemberNotFound = new("groups.member-not-found", ErrorKind.NotFound);

    /// <summary>The change would leave the group without an active admin. Nobody is promoted automatically.</summary>
    public static readonly Error LastAdmin = new("groups.last-admin", ErrorKind.Conflict);

    /// <summary>Nobody removes themselves: leaving is its own route, with its own rule.</summary>
    public static readonly Error UseLeave = new("groups.use-leave", ErrorKind.Validation);

    /// <summary>A guest without an account (E3.5) is always a drop-in.</summary>
    public static readonly Error RegularNeedsAccount = new("groups.regular-needs-account", ErrorKind.Validation);

    public static readonly Error InviteLimit = new("groups.invite-limit", ErrorKind.Conflict);

    /// <summary>For an admin: the invite id is not one of this group's invites, whatever group it belongs to.</summary>
    public static readonly Error InviteNotFound = new("groups.invite-not-found", ErrorKind.NotFound);

    /// <summary>For whoever holds a token: revoked, expired, missing and malformed look the same, byte for byte.</summary>
    public static readonly Error InviteInvalid = new("groups.invite-invalid", ErrorKind.NotFound);

    /// <summary>Gabriel's answer 19: whoever an admin removed does not come back through a link.</summary>
    public static readonly Error MemberRemoved = new("groups.member-removed", ErrorKind.Forbidden);

    /// <summary>The settings document or patch broke a rule of the catalog. The path of the refusal stays out of the body (ADR 0039).</summary>
    public static readonly Error SettingsInvalid = new("groups.settings-invalid", ErrorKind.Validation);

    /// <summary>For an admin: the template is not one of this group's saved templates, whatever group it belongs to.</summary>
    public static readonly Error TemplateNotFound = new("groups.template-not-found", ErrorKind.NotFound);

    /// <summary>Creating a group: the ready-made template key is not in the catalog.</summary>
    public static readonly Error UnknownTemplateKey = new("groups.template-not-found", ErrorKind.Validation);

    public static readonly Error TemplateNameInvalid = new("groups.template-name-invalid", ErrorKind.Validation);

    public static readonly Error TemplateLimit = new("groups.template-limit", ErrorKind.Conflict);
}
