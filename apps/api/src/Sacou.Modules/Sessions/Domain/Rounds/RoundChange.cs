using System.Collections.Immutable;
using Sacou.Modules.Sessions.Domain.Attendances;

namespace Sacou.Modules.Sessions.Domain.Rounds;

/// <summary>
/// What a write did to the aggregate: the round after the change, the attendances whose rows the store
/// writes (new or changed) and the events. Nothing to write is a success without effect, such as saying
/// "vou" twice. <see cref="RoundRowChanged"/> is for changes to the round itself (cancelling, moving).
/// </summary>
internal sealed record RoundChange(Round Round, ImmutableArray<Attendance> ChangedAttendances, ImmutableArray<RoundEvent> Events)
{
    public bool RoundRowChanged { get; init; }

    /// <summary>The published teams were replaced (ADR 0078): the store rewrites their rows whole.</summary>
    public bool TeamsChanged { get; init; }

    public bool IsEmpty => !RoundRowChanged && !TeamsChanged && ChangedAttendances.IsEmpty && Events.IsEmpty;

    public static RoundChange Unchanged(Round round) => new(round, [], []);

    /// <summary>Runs the next step on the round this change left; a member changed twice keeps its last row.</summary>
    public RoundChange Then(Func<Round, RoundChange> next)
    {
        var following = next(Round);
        var rewritten = following.ChangedAttendances.Select(attendance => attendance.Member).ToHashSet();
        return new RoundChange(
            following.Round,
            [.. ChangedAttendances.Where(attendance => !rewritten.Contains(attendance.Member)), .. following.ChangedAttendances],
            [.. Events, .. following.Events])
        {
            RoundRowChanged = RoundRowChanged || following.RoundRowChanged,
            TeamsChanged = TeamsChanged || following.TeamsChanged,
        };
    }
}
