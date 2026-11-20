namespace Sacou.Modules.Notifications.Domain;

/// <summary>The notification types of the pilot: only the waitlist promotion (question 113; docs/dominio/notificacoes.md).</summary>
internal enum NotificationKind
{
    WaitlistPromoted,
}

internal enum PushPlatform
{
    Android,
    Ios,
}
