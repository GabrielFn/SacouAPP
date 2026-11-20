using Sacou.Shared.Results;

namespace Sacou.Modules.Notifications.Domain;

/// <summary>Stable codes, listed in docs/dominio/notificacoes.md. The app maps each one to its pt-BR text.</summary>
internal static class NotificationErrors
{
    /// <summary>The push token is missing or out of shape (ADR 0069, D8).</summary>
    public static readonly Error TokenInvalid = new("notifications.token-invalid", ErrorKind.Validation);

    /// <summary>The installation id is the empty uuid.</summary>
    public static readonly Error InstallationInvalid = new("notifications.installation-invalid", ErrorKind.Validation);

    /// <summary>The page cursor is not one the list gave.</summary>
    public static readonly Error CursorInvalid = new("notifications.cursor-invalid", ErrorKind.Validation);

    /// <summary>No such notification, or one of another person: the same answer, so an id reveals nothing.</summary>
    public static readonly Error NotificationNotFound = new("notifications.notification-not-found", ErrorKind.NotFound);
}
