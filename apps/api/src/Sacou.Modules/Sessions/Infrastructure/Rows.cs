namespace Sacou.Modules.Sessions.Infrastructure;

/// <summary>A row of <c>sessions.round_series</c>. Persistence shape only: the domain never sees it.</summary>
internal sealed class SeriesRow
{
    public required Guid Id { get; init; }

    public required Guid GroupId { get; init; }

    /// <summary>ISO weekday, 1 (Monday) to 7 (Sunday).</summary>
    public required short Weekday { get; init; }

    public required TimeOnly LocalTime { get; init; }

    public required string Venue { get; init; }

    public required string TimeZone { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset? StoppedAt { get; init; }
}

/// <summary>A row of <c>sessions.rounds</c>: the date and time local, the instant calculated, the settings layer opaque.</summary>
internal sealed class RoundRow
{
    public required Guid Id { get; init; }

    public required Guid GroupId { get; init; }

    public Guid? SeriesId { get; init; }

    public required DateOnly LocalDate { get; init; }

    public required TimeOnly LocalTime { get; init; }

    public required string TimeZone { get; init; }

    public required DateTimeOffset StartsAt { get; init; }

    public required string Venue { get; init; }

    public string? SettingsLayer { get; init; }

    public required string Status { get; init; }

    public required int NextSequence { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>The public link's code, in clear (ADR 0070, D1); null only for a round made before the link existed.</summary>
    public string? LinkCode { get; init; }

    /// <summary>When someone tapped "Encerrar rodada" (ADR 0072, D1); null while nobody did.</summary>
    public DateTimeOffset? ClosedAt { get; init; }

    /// <summary>When the published teams were confirmed (ADR 0078); null while there are none. Their rows are in <c>round_teams</c>.</summary>
    public DateTimeOffset? TeamsConfirmedAt { get; init; }
}

/// <summary>
/// A row of <c>sessions.round_teams</c>: one member in the published teams (ADR 0078). <see cref="TeamNumber"/> starts at 1;
/// null is the queue of reserves. <see cref="Position"/> starts at 1 inside the team or the queue. Only ids: no level.
/// </summary>
internal sealed class RoundTeamSlotRow
{
    public required Guid RoundId { get; init; }

    public required Guid MemberId { get; init; }

    public short? TeamNumber { get; init; }

    public required short Position { get; init; }
}

/// <summary>A row of <c>sessions.attendances</c>: by <c>MemberId</c> only, no name, e-mail or user.</summary>
internal sealed class AttendanceRow
{
    public required Guid RoundId { get; init; }

    public required Guid MemberId { get; init; }

    public required string Status { get; init; }

    public required int Sequence { get; init; }

    public required string Source { get; init; }

    public required DateTimeOffset RespondedAt { get; init; }

    public DateTimeOffset? PromotedAt { get; init; }

    /// <summary><c>app</c> or <c>web</c>: where the answer that last changed the row came from (ADR 0070, D3).</summary>
    public required string Channel { get; init; }
}
