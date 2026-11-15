using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Queue;

/// <summary>
/// Port of <c>NextMatchInput</c>: everything comes from the resolved settings (ADR 0017) and never goes
/// into an event (ADR 0050). Read as received, because the screen or a hostile caller may send anything:
/// the planner checks each value in the order of ADR 0050, and the criterion only when someone leaves by
/// it. Properties in the key order of the golden input.
/// </summary>
internal sealed record NextMatchInput(
    RawValue Criterion,
    RawValue CriterionInput,
    RawValue PlayersPerTeam,
    RawValue ExitMode,
    RawValue WinnerExit,
    RawValue WinnerCriterionInput);

/// <summary>
/// Who leaves the losing team (<c>queue.exitMode</c>); the count of a fixed count goes from 1 to 24.
/// Closed: each mode names its Strategy, so running one needs no lookup.
/// </summary>
internal abstract record QueueExitMode
{
    private protected QueueExitMode()
    {
    }

    internal abstract IQueueExitModeStep Step { get; }
}

internal sealed record AutomaticExitMode : QueueExitMode
{
    public static readonly AutomaticExitMode Instance = new();

    private AutomaticExitMode()
    {
    }

    internal override IQueueExitModeStep Step => AutomaticStep.Instance;
}

internal sealed record WholeTeamExitMode : QueueExitMode
{
    public static readonly WholeTeamExitMode Instance = new();

    private WholeTeamExitMode()
    {
    }

    internal override IQueueExitModeStep Step => WholeTeamStep.Instance;
}

internal sealed record FixedCountExitMode(int Count) : QueueExitMode
{
    internal override IQueueExitModeStep Step => new FixedCountStep(Count);
}

/// <summary>"Vencedor também sai": the winner leaves too after <c>Wins</c> wins in a row, from 1 to 10.</summary>
internal sealed record WinnerExit(int Wins);

/// <summary>The criterion of the group with the input of one side, the loser's or the winner's, as received.</summary>
internal sealed record QueueSideChoice(RawValue Criterion, RawValue CriterionInput);

/// <summary>Who of the losing team may leave, how many leave, and the round so far.</summary>
internal sealed record QueueExitCandidates(int Count, ImmutableArray<string> MemberIds, CourtSessionState State);

/// <summary>
/// Where the member who leaves was, and so where the one who comes in stands: an index of the lineup or
/// of the bench, the libero, or an index of the members of the team with the rotation off.
/// </summary>
internal sealed record PartialExitPlace
{
    public const string LineupArea = "lineup";
    public const string BenchArea = "bench";
    public const string LiberoArea = "libero";
    public const string TeamArea = "team";

    private PartialExitPlace(string area, int? index)
    {
        Area = area;
        Index = index;
    }

    public string Area { get; }

    /// <summary><c>null</c> only for the libero, which has no index.</summary>
    public int? Index { get; }

    public static PartialExitPlace Lineup(int index) => new(LineupArea, index);

    public static PartialExitPlace Bench(int index) => new(BenchArea, index);

    public static PartialExitPlace Libero { get; } = new(LiberoArea, index: null);

    public static PartialExitPlace Team(int index) => new(TeamArea, index);
}

/// <summary>A member who leaves and the one who takes the place. Properties in the key order of the plan.</summary>
internal sealed record PartialExit(
    int ConsecutiveMatches,
    string Incoming,
    string Outgoing,
    PartialExitPlace Place,
    TeamSide Side);

/// <summary>The winner that leaves too, and the wins in a row that made it leave.</summary>
internal sealed record WinnerLeaving(TeamSide Side, int Streak);

/// <summary>
/// Port of <c>NextMatchPlan</c>: what screen 11 shows. <c>EnteringTeams</c> are the sides a new team
/// comes into (<c>a</c> before <c>b</c>), with the rotation off; <c>Exits</c> are the partial exits,
/// side <c>a</c> first and then in the order of the team. Properties in the key order of the plan.
/// </summary>
internal sealed record NextMatchPlan(
    ImmutableArray<TeamSide> EnteringTeams,
    ImmutableArray<PartialExit> Exits,
    TeamQueue Queue,
    BySide<TeamState?> Rotations,
    BySide<TeamRoster> Teams,
    WinnerLeaving? WinnerLeaving);

/// <summary>A refusal of the plan: a code of <see cref="QueueRefusalCodes"/>, or an invalid payload with its field.</summary>
internal sealed record QueueCommandError(string Code, string? Field)
{
    public static QueueCommandError Refused(string code) => new(code, Field: null);
}

/// <summary>The codes of <c>QueueRefusalCode</c>, and the field of a queue above the limit.</summary>
internal static class QueueRefusalCodes
{
    public const string InvalidExitChoice = "invalid-exit-choice";
    public const string InvalidExitMode = "invalid-exit-mode";
    public const string InvalidPlayersPerTeam = "invalid-players-per-team";
    public const string InvalidWinnerExit = "invalid-winner-exit";
    public const string MatchAlreadyOpen = "match-already-open";
    public const string NoFinishedMatch = "no-finished-match";
    public const string InvalidPayload = PayloadError.InvalidPayloadCode;
    public const string QueueField = "queue";
}
