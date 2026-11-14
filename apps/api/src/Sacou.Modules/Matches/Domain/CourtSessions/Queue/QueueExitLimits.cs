using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Queue;

/// <summary>Port of <c>queue/constants.data.ts</c>: the keys and the limits of the queue plan (ADR 0029, ADR 0050).</summary>
internal static class QueueExitLimits
{
    public const string ConsecutiveMatches = "consecutive-matches";
    public const string ArrivalOrder = "arrival-order";
    public const string Draw = "draw";
    public const string Manual = "manual";

    public const string Automatic = "automatic";
    public const string WholeTeam = "whole-team";
    public const string FixedCount = "fixed-count";

    /// <summary>Who leaves a losing team when fewer are waiting than a team; "nível" is out of the MVP.</summary>
    public static readonly ImmutableArray<string> CriterionKeys = [ConsecutiveMatches, ArrivalOrder, Draw, Manual];

    /// <summary>Who leaves the losing team (E2.12): the mode of the MVP, the whole team, or a fixed count.</summary>
    public static readonly ImmutableArray<string> ExitModeKinds = [Automatic, WholeTeam, FixedCount];

    /// <summary>The default of a group, by <c>decisoes.md:11</c>.</summary>
    public const string DefaultCriterion = ConsecutiveMatches;

    /// <summary>The default of a group: the mode of E2.6.</summary>
    public const string DefaultExitMode = Automatic;

    /// <summary>A team in the queue has at least one member.</summary>
    public const int MinPlayersPerTeam = ScoreLimits.MinTeamMembers;

    /// <summary>A fixed count goes from one to a whole team.</summary>
    public const int MinFixedExitCount = 1;
    public const int MaxFixedExitCount = ScoreLimits.MaxTeamMembers;

    /// <summary>The count of screen 18a when a group picks the fixed count.</summary>
    public const int DefaultFixedExitCount = 2;

    /// <summary>"Vencedor também sai" after X wins in a row: a small product limit, easy to change.</summary>
    public const int MinWinnerExitWins = 1;
    public const int MaxWinnerExitWins = 10;

    /// <summary>Off in a new group, with X ready at 3 (question P3 of E2.12).</summary>
    public const bool DefaultWinnerExitEnabled = false;
    public const int DefaultWinnerExitWins = 3;
}
