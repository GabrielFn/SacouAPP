using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>Stable codes, listed in docs/dominio/rodadas.md. The app maps each one to its pt-BR text.</summary>
internal static class RoundErrors
{
    /// <summary>Date, time or venue outside the rule: not a date, in the past, beyond a year, wrong format.</summary>
    public static readonly Error RoundInvalid = new("sessions.round-invalid", ErrorKind.Validation);

    /// <summary>An edit moved a round of a series to a date the series already has a round on.</summary>
    public static readonly Error RoundDateTaken = new("sessions.round-date-taken", ErrorKind.Conflict);

    public static readonly Error RoundNotFound = new("sessions.round-not-found", ErrorKind.NotFound);

    public static readonly Error SeriesNotFound = new("sessions.series-not-found", ErrorKind.NotFound);

    /// <summary>The target is not an active member of the route's group: missing, left, removed or from another group look the same.</summary>
    public static readonly Error MemberNotFound = new("sessions.member-not-found", ErrorKind.NotFound);

    public static readonly Error RoundLimit = new("sessions.round-limit", ErrorKind.Conflict);

    public static readonly Error SeriesLimit = new("sessions.series-limit", ErrorKind.Conflict);

    /// <summary>Cancelled, or (for a player) already started.</summary>
    public static readonly Error RoundClosed = new("sessions.round-closed", ErrorKind.Conflict);

    public static readonly Error RoundFull = new("sessions.round-full", ErrorKind.Conflict);

    public static readonly Error DropInWindowClosed = new("sessions.drop-in-window-closed", ErrorKind.Conflict);

    public static readonly Error AttendanceDisabled = new("sessions.attendance-disabled", ErrorKind.Conflict);
}
