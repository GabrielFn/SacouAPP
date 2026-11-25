using Sacou.Modules.Groups.Contracts;
using Sacou.Modules.Sessions.Contracts;

namespace Sacou.Api.Operations;

/// <summary>
/// The gate of phase 2 (<c>produto.md:212</c>, question 215, ADR 0085, D3): pure, from the Sessions' weeks and the Groups'
/// list. A week counts for a group when it held a round in it; "4 rounds in a row" is 4 weeks in a row, each one at the
/// target or above. A rate with nothing to divide by is null, never 0.
/// </summary>
internal static class OpsGateCalculator
{
    /// <summary>The target, as a fraction of whole numbers so the comparison has no rounding: 60 in 100.</summary>
    public const int TargetPercent = 60;

    public const int RequiredWeeks = 4;

    public const int GroupsGoal = 5;

    private const int Percent = 100;

    private const int DaysPerWeek = 7;

    public static double Target => (double)TargetPercent / Percent;

    public static OpsGate Gate(IReadOnlyList<HeldWeek> held, IReadOnlyList<CountedGroup> groups, IReadOnlyList<DateOnly> weeks)
    {
        ArgumentNullException.ThrowIfNull(held);
        ArgumentNullException.ThrowIfNull(groups);
        ArgumentNullException.ThrowIfNull(weeks);
        var byGroup = groups.Select(group => Group(group.Name, [.. held.Where(week => week.GroupId == group.GroupId)])).ToList();
        return new OpsGate(
            Target,
            RequiredWeeks,
            GroupsGoal,
            byGroup.Count(group => group.MeetsGate),
            Count(held),
            [.. weeks.Select(week => new OpsGateWeek(week, Count([.. held.Where(row => row.WeekStart == week)])))],
            byGroup);
    }

    /// <summary>The sums of some weeks, and their two rates.</summary>
    public static OpsGateCount Count(IReadOnlyList<HeldWeek> rows)
    {
        ArgumentNullException.ThrowIfNull(rows);
        var confirmed = rows.Sum(row => row.Confirmed);
        var self = rows.Sum(row => row.SelfAnswered);
        var link = rows.Sum(row => row.ByLink);
        return new OpsGateCount(rows.Sum(row => row.Rounds), confirmed, self, link, Rate(self, confirmed), Rate(link, confirmed));
    }

    /// <summary>A share in <c>0..1</c>, or null when there is nothing to divide by.</summary>
    public static double? Rate(int part, int whole) => whole == 0 ? null : (double)part / whole;

    /// <summary>Whether a week's answers reach the target: never a week without confirmed.</summary>
    public static bool ReachesTarget(OpsGateCount week)
    {
        ArgumentNullException.ThrowIfNull(week);
        return week.Rounds > 0 && week.Confirmed > 0 && (long)week.SelfAnswered * Percent >= (long)week.Confirmed * TargetPercent;
    }

    /// <summary>The most weeks one right after the other among <paramref name="weeks"/> (Mondays).</summary>
    public static int LongestRun(IEnumerable<DateOnly> weeks)
    {
        ArgumentNullException.ThrowIfNull(weeks);
        var ordered = weeks.Distinct().Order().ToList();
        var longest = 0;
        var current = 0;
        for (var index = 0; index < ordered.Count; index++)
        {
            current = index > 0 && ordered[index].DayNumber - ordered[index - 1].DayNumber == DaysPerWeek ? current + 1 : 1;
            longest = Math.Max(longest, current);
        }

        return longest;
    }

    private static OpsGateGroup Group(string name, IReadOnlyList<HeldWeek> rows)
    {
        var weeks = rows.GroupBy(row => row.WeekStart).Select(week => (Week: week.Key, Count: Count([.. week]))).ToList();
        var held = weeks.Where(week => week.Count.Rounds > 0).Select(week => week.Week);
        var atTarget = weeks.Where(week => ReachesTarget(week.Count)).Select(week => week.Week);
        return new OpsGateGroup(name, Count(rows), LongestRun(held), LongestRun(atTarget) >= RequiredWeeks);
    }
}
