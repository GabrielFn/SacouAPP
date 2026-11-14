using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Queue;

/// <summary>The Strategy of a mode, port of <c>queue/exit-modes.ts</c>: one team leaving, pure (ADR 0050).</summary>
internal interface IQueueExitModeStep
{
    Result<ExitStepOutcome, QueueCommandError> Run(ExitStepContext context);
}

/// <summary>The mode of E2.6: the loser leaves whole and goes to the singles, or the singles replace some.</summary>
internal sealed class AutomaticStep : IQueueExitModeStep
{
    public static readonly AutomaticStep Instance = new();

    private AutomaticStep()
    {
    }

    public Result<ExitStepOutcome, QueueCommandError> Run(ExitStepContext context) =>
        ExitSteps.EnterFirstTeam(context, left => new TeamQueue(left.MemberIds, [])) is { } entered
            ? Result<ExitStepOutcome, QueueCommandError>.Success(entered)
            : ExitSteps.ReplaceBySingles(context, RotationAfterExit.Kept);
}

/// <summary>
/// The team leaves whole and goes back to the end of the teams of the queue, never to the singles. With
/// only singles waiting, the team is set again: the singles come in, the criterion picks who of the team
/// rests, and the lineup is to set (question P2 of E2.12).
/// </summary>
internal sealed class WholeTeamStep : IQueueExitModeStep
{
    public static readonly WholeTeamStep Instance = new();

    private WholeTeamStep()
    {
    }

    public Result<ExitStepOutcome, QueueCommandError> Run(ExitStepContext context) =>
        ExitSteps.EnterFirstTeam(context, left => new TeamQueue([], [left])) is { } entered
            ? Result<ExitStepOutcome, QueueCommandError>.Success(entered)
            : ExitSteps.ReplaceBySingles(context, RotationAfterExit.Reset);
}

/// <summary>
/// The queue becomes one line (teams in order, member by member, then the singles): <c>k</c> leave, the
/// smallest of the count, the team and the line, and the first <c>k</c> of the line take their places.
/// </summary>
internal sealed class FixedCountStep(int count) : IQueueExitModeStep
{
    public Result<ExitStepOutcome, QueueCommandError> Run(ExitStepContext context)
    {
        var line = QueueRules.QueueMembers(context.Pool);
        var leaving = Math.Min(Math.Min(count, context.Roster.MemberIds.Length), line.Length);
        return ExitSteps.ReplaceMembers(
            context,
            [.. line.Take(leaving)],
            new TeamQueue([.. line.Skip(leaving)], []),
            RotationAfterExit.Kept);
    }
}

/// <summary>The modes by kind, read by a <c>switch</c> and never by a dictionary (ADR 0033, D10).</summary>
internal static class QueueExitModes
{
    private const string KindKey = "kind";
    private const string CountKey = "count";

    /// <summary>A known kind, and a count from 1 to 24 for the fixed count; <c>null</c> otherwise.</summary>
    public static QueueExitMode? Parse(RawValue value)
    {
        if (value is not RawObject mode || PayloadValues.Member(mode, KindKey) is not RawString { Value: var kind })
        {
            return null;
        }

        return kind switch
        {
            QueueExitLimits.Automatic => AutomaticExitMode.Instance,
            QueueExitLimits.WholeTeam => WholeTeamExitMode.Instance,
            QueueExitLimits.FixedCount => PayloadValues.Integer(
                PayloadValues.Member(mode, CountKey),
                QueueExitLimits.MinFixedExitCount,
                QueueExitLimits.MaxFixedExitCount) is { } count ? new FixedCountExitMode(count) : null,
            _ => null,
        };
    }

    /// <summary>One team leaving by the mode; nobody waiting leaves it as it is (rule 1 of <c>fila.md</c>).</summary>
    public static Result<ExitStepOutcome, QueueCommandError> RunExitStep(ExitStepContext context, QueueExitMode mode) =>
        QueueRules.QueueSize(context.Pool) == 0
            ? Result<ExitStepOutcome, QueueCommandError>.Success(ExitSteps.Stay(context))
            : mode.Step.Run(context);
}
