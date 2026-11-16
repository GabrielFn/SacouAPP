using Sacou.Shared.Results;

namespace Sacou.Modules.Sessions.Domain.Draw;

/// <summary>Stable codes, listed in docs/dominio/sorteio.md. None of them carries a name or a level.</summary>
internal static class DrawErrors
{
    /// <summary>The round's settings have the draw off (<c>draw.enabled</c>).</summary>
    public static readonly Error DrawDisabled = new("sessions.draw-disabled", ErrorKind.Conflict);

    /// <summary>Fewer than <see cref="DrawLimits.MinPlayers"/> confirmed players: not even two teams of two.</summary>
    public static readonly Error NotEnoughPlayers = new("sessions.draw-not-enough-players", ErrorKind.Conflict);

    /// <summary>The reserves sent are not exactly the number left over, are repeated or are not confirmed.</summary>
    public static readonly Error ReservesInvalid = new("sessions.draw-reserves-invalid", ErrorKind.Validation);

    /// <summary>A lock with someone outside the teams, with oneself, repeated, or more than <see cref="DrawLimits.MaxLocks"/> locks.</summary>
    public static readonly Error LockInvalid = new("sessions.draw-lock-invalid", ErrorKind.Validation);

    /// <summary>The players locked together are more than a team holds.</summary>
    public static readonly Error LockTooLarge = new("sessions.draw-lock-too-large", ErrorKind.Validation);

    /// <summary>Two players locked together, directly or through others, are also kept apart.</summary>
    public static readonly Error LocksConflict = new("sessions.draw-locks-conflict", ErrorKind.Validation);

    /// <summary>No split of the players into the teams respects every lock.</summary>
    public static readonly Error LocksUnsatisfiable = new("sessions.draw-locks-unsatisfiable", ErrorKind.Validation);
}
