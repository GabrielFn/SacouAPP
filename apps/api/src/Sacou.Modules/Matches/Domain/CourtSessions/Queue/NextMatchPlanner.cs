using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Queue;

/// <summary>
/// Port of <c>queue/plan-next-match.ts</c>: proposes the next match after the last finished one, by the
/// mode of the group and the "vencedor também sai" (ADR 0029, ADR 0050). Only a calculation: the
/// <c>MatchStarted</c> of the next match records it. Refusals are results, never exceptions.
/// </summary>
internal static class NextMatchPlanner
{
    private const string WinsKey = "wins";

    public static Result<NextMatchPlan, QueueCommandError> Plan(CourtSessionState state, NextMatchInput input)
    {
        var checkedInput = Check(state, input);
        if (checkedInput.IsFailure)
        {
            return checkedInput.Forward<NextMatchPlan>();
        }

        var settings = checkedInput.Value;
        var planned = PlanAfter(state, state.FinishedMatches[^1], input, settings);
        if (planned.IsFailure)
        {
            return planned;
        }

        var queue = FormTeams(planned.Value.Queue, settings.PlayersPerTeam);
        return QueueRules.QueueSize(queue) > QueueRules.MaxQueueMembers
            ? Result<NextMatchPlan, QueueCommandError>.Failure(
                new QueueCommandError(QueueRefusalCodes.InvalidPayload, QueueRefusalCodes.QueueField))
            : Result<NextMatchPlan, QueueCommandError>.Success(planned.Value with { Queue = queue });
    }

    /// <summary>The first refusal of the input, in the order of ADR 0050; the criterion waits for a partial exit.</summary>
    private static Result<CheckedInput, QueueCommandError> Check(CourtSessionState state, NextMatchInput input)
    {
        if (state.CurrentMatch is not null)
        {
            return Refused<CheckedInput>(QueueRefusalCodes.MatchAlreadyOpen);
        }

        if (state.FinishedMatches.IsEmpty)
        {
            return Refused<CheckedInput>(QueueRefusalCodes.NoFinishedMatch);
        }

        if (PayloadValues.Integer(input.PlayersPerTeam, QueueExitLimits.MinPlayersPerTeam, ScoreLimits.MaxTeamMembers) is not { } playersPerTeam)
        {
            return Refused<CheckedInput>(QueueRefusalCodes.InvalidPlayersPerTeam);
        }

        if (QueueExitModes.Parse(input.ExitMode) is not { } exitMode)
        {
            return Refused<CheckedInput>(QueueRefusalCodes.InvalidExitMode);
        }

        return ParseWinnerExit(input.WinnerExit) is { } winnerExit
            ? Result<CheckedInput, QueueCommandError>.Success(new CheckedInput(playersPerTeam, exitMode, winnerExit.Value))
            : Refused<CheckedInput>(QueueRefusalCodes.InvalidWinnerExit);
    }

    /// <summary>JSON null turns it off; otherwise an object with wins from 1 to 10. <c>null</c> for anything else.</summary>
    private static Optional<WinnerExit>? ParseWinnerExit(RawValue value)
    {
        if (value is RawNull)
        {
            return Optional<WinnerExit>.None;
        }

        return value is RawObject winnerExit
            && PayloadValues.Integer(
                PayloadValues.Member(winnerExit, WinsKey),
                QueueExitLimits.MinWinnerExitWins,
                QueueExitLimits.MaxWinnerExitWins) is { } wins
                ? Optional<WinnerExit>.Some(new WinnerExit(wins))
                : null;
    }

    /// <summary>Without a winner or with nobody waiting, nobody leaves, not even a winner past X (rule 1).</summary>
    private static Result<NextMatchPlan, QueueCommandError> PlanAfter(
        CourtSessionState state, FinishedMatch match, NextMatchInput input, CheckedInput settings)
    {
        if (match.Winner is not { } winner || QueueRules.QueueSize(state.Queue) == 0)
        {
            return Result<NextMatchPlan, QueueCommandError>.Success(AssemblePlan(state, match, [], winnerLeaving: null));
        }

        var winnerLeaving = WinnerLeavingOf(state, winner, settings.WinnerExit);
        var steps = RunSteps(state, match, input, settings.ExitMode, ExitOrder(winner, winnerLeaving is not null));
        return steps.IsSuccess
            ? Result<NextMatchPlan, QueueCommandError>.Success(AssemblePlan(state, match, steps.Value, winnerLeaving))
            : steps.Forward<NextMatchPlan>();
    }

    /// <summary>The winner leaves too when it has at least <c>Wins</c> wins in a row (ADR 0050).</summary>
    private static WinnerLeaving? WinnerLeavingOf(CourtSessionState state, TeamSide winner, WinnerExit? winnerExit)
    {
        var streak = MatchHistory.GetWinStreak(state, winner);
        return winnerExit is not null && streak >= winnerExit.Wins ? new WinnerLeaving(winner, streak) : null;
    }

    /// <summary>
    /// Who leaves, in order: the winner first when it leaves too, with the whole queue, and then the loser
    /// with what is left (question P1 of E2.12).
    /// </summary>
    private static ImmutableArray<TeamSide> ExitOrder(TeamSide winner, bool winnerLeaves) =>
        winnerLeaves ? [winner, winner.Opponent()] : [winner.Opponent()];

    /// <summary>Runs the steps in order over one shared queue; whoever leaves only joins it at the end.</summary>
    private static Result<ImmutableArray<SideStep>, QueueCommandError> RunSteps(
        CourtSessionState state, FinishedMatch match, NextMatchInput input, QueueExitMode mode, ImmutableArray<TeamSide> sides)
    {
        var done = ImmutableArray<SideStep>.Empty;
        foreach (var side in sides)
        {
            var context = new ExitStepContext(
                ChoiceFor(input, side == match.Winner),
                PoolAfter(state, done),
                match.Match.Teams.Of(side),
                match.Match.Rotations.Of(side),
                side,
                state);
            var ran = QueueExitModes.RunExitStep(context, mode);
            if (ran.IsFailure)
            {
                return ran.Forward<ImmutableArray<SideStep>>();
            }

            done = done.Add(new SideStep(side, ran.Value));
        }

        return Result<ImmutableArray<SideStep>, QueueCommandError>.Success(done);
    }

    /// <summary>The loser chooses with <c>criterionInput</c>, and the winner with <c>winnerCriterionInput</c>.</summary>
    private static QueueSideChoice ChoiceFor(NextMatchInput input, bool isWinner) =>
        new(input.Criterion, isWinner ? input.WinnerCriterionInput : input.CriterionInput);

    /// <summary>The queue the next step sees: what the last one left, or the queue of the round.</summary>
    private static TeamQueue PoolAfter(CourtSessionState state, ImmutableArray<SideStep> steps) =>
        steps.IsEmpty ? state.Queue : steps[^1].Outcome.Pool;

    /// <summary>The match after the steps: who left joins the queue, the winner first, each in team order.</summary>
    private static NextMatchPlan AssemblePlan(
        CourtSessionState state, FinishedMatch match, ImmutableArray<SideStep> steps, WinnerLeaving? winnerLeaving)
    {
        var pool = PoolAfter(state, steps);
        ImmutableArray<SideStep> inSideOrder = [.. TeamSide.All.SelectMany(side => steps.Where(step => step.Side == side))];
        var (a, b) = (OutcomeOf(steps, TeamSide.A), OutcomeOf(steps, TeamSide.B));
        var rotations = match.Match.Rotations;
        var teams = match.Match.Teams;
        return new NextMatchPlan(
            [.. inSideOrder.Where(step => step.Outcome.Entered).Select(step => step.Side)],
            [.. inSideOrder.SelectMany(step => step.Outcome.Exits)],
            new TeamQueue(
                [.. pool.Players, .. steps.SelectMany(step => step.Outcome.Leaving.Players)],
                [.. pool.Teams, .. steps.SelectMany(step => step.Outcome.Leaving.Teams)]),
            new BySide<TeamState?>(a is null ? rotations.A : a.Rotation, b is null ? rotations.B : b.Rotation),
            new BySide<TeamRoster>(a?.Roster ?? teams.A, b?.Roster ?? teams.B),
            winnerLeaving);
    }

    private static ExitStepOutcome? OutcomeOf(ImmutableArray<SideStep> steps, TeamSide side) =>
        steps.FirstOrDefault(step => step.Side == side)?.Outcome;

    /// <summary>Single players who add up to a team form one, by order of arrival (<c>decisoes.md:11</c>).</summary>
    private static TeamQueue FormTeams(TeamQueue queue, int playersPerTeam)
    {
        var grouped = queue.Players.Length / playersPerTeam * playersPerTeam;
        IEnumerable<TeamRoster> formed = queue.Players.Take(grouped).Chunk(playersPerTeam).Select(chunk => new TeamRoster([.. chunk]));
        return new TeamQueue([.. queue.Players.Skip(grouped)], [.. queue.Teams, .. formed]);
    }

    private static Result<T, QueueCommandError> Refused<T>(string code)
        where T : notnull =>
        Result<T, QueueCommandError>.Failure(QueueCommandError.Refused(code));

    /// <summary>The values of the input once checked: the mode, and the winner exit or <c>null</c> when it is off.</summary>
    private sealed record CheckedInput(int PlayersPerTeam, QueueExitMode ExitMode, WinnerExit? WinnerExit);

    private sealed record SideStep(TeamSide Side, ExitStepOutcome Outcome);
}
