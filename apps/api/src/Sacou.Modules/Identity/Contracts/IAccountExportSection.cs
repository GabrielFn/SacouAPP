namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// One part of the personal data export, <c>GET /v1/me/export</c> (E3.16, ADR 0056). The Identity module owns the
/// document and each module adds what it keeps about the person through this port, so no module reads another's
/// tables (dependency inversion: Groups and Sessions implement it, the Identity never references them).
/// </summary>
/// <remarks>
/// An implementation returns only what the API keeps about <em>that</em> person: never another member's name,
/// note or attendance, never the admin's note about the person (Gabriel, question 42), never an internal key
/// such as the user id or the Firebase subject.
/// </remarks>
public interface IAccountExportSection
{
    /// <summary>The key of the section in the document: one of <see cref="AccountExportSections"/>.</summary>
    string Name { get; }

    /// <summary>The place of the section in the document, ascending: one of <see cref="AccountExportSections"/>.</summary>
    int Order { get; }

    /// <summary>The value of the section, written with the API's JSON rules; null when there is nothing (a person without a profile).</summary>
    Task<object?> ExportAsync(Guid userId, CancellationToken cancellationToken);
}

/// <summary>
/// The fixed keys and order of the export document (ADR 0056, D9). A new section (matches, stats, MVP votes) adds a
/// key here; the <see cref="FormatVersion"/> goes up only when a section changes shape, not when one is added.
/// </summary>
public static class AccountExportSections
{
    public const string Format = "sacou-personal-data";
    public const int FormatVersion = 1;

    public const string Account = "account";
    public const int AccountOrder = 100;

    public const string Profile = "profile";
    public const int ProfileOrder = 200;

    public const string Groups = "groups";
    public const int GroupsOrder = 300;

    public const string Attendances = "attendances";
    public const int AttendancesOrder = 400;

    /// <summary>The court batches the person wrote (E3.7, ADR 0060, D16).</summary>
    public const string CourtWrites = "courtWrites";
    public const int CourtWritesOrder = 500;

    /// <summary>The phones and the notifications of the person, never a push token (E3.11, ADR 0069, D9).</summary>
    public const string Notifications = "notifications";
    public const int NotificationsOrder = 600;
}
