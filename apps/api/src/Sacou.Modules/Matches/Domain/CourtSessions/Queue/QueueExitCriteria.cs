using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Queue;

/// <summary>
/// The Strategy of <c>decisoes.md:28</c>, port of <c>queue/exit-criteria.ts</c>: the members who leave,
/// <c>Count</c> of them, in the order of the criterion; <c>null</c> when the input does not allow a choice.
/// The input is the object received, read member by member.
/// </summary>
internal interface IQueueExitCriterion
{
    ImmutableArray<string>? Choose(QueueExitCandidates candidates, RawObject input);
}

/// <summary>
/// The default: who has played the most matches in a row leaves first. A tie goes to whoever played the
/// most matches in the round, and then to whoever arrived first (decision of the product owner).
/// </summary>
internal sealed class ConsecutiveMatchesCriterion : IQueueExitCriterion
{
    public static readonly ConsecutiveMatchesCriterion Instance = new();

    private ConsecutiveMatchesCriterion()
    {
    }

    /// <summary>The sort is stable, so the arrival order breaks the last tie.</summary>
    public ImmutableArray<string>? Choose(QueueExitCandidates candidates, RawObject input) =>
        QueueExitCriteria.ArrivalOrder(input, candidates) is { } order
            ? [.. order
                .OrderByDescending(memberId => MatchHistory.GetConsecutiveMatches(candidates.State, memberId))
                .ThenByDescending(memberId => MatchHistory.GetMatchesPlayed(candidates.State, memberId))
                .Take(candidates.Count)]
            : null;
}

/// <summary>Whoever arrived first leaves first.</summary>
internal sealed class ArrivalOrderCriterion : IQueueExitCriterion
{
    public static readonly ArrivalOrderCriterion Instance = new();

    private ArrivalOrderCriterion()
    {
    }

    public ImmutableArray<string>? Choose(QueueExitCandidates candidates, RawObject input) =>
        QueueExitCriteria.ArrivalOrder(input, candidates) is { } order ? [.. order.Take(candidates.Count)] : null;
}

/// <summary>The draw comes shuffled from outside: a permutation of the losing team, and the first leave.</summary>
internal sealed class DrawCriterion : IQueueExitCriterion
{
    public static readonly DrawCriterion Instance = new();

    private DrawCriterion()
    {
    }

    public ImmutableArray<string>? Choose(QueueExitCandidates candidates, RawObject input)
    {
        var order = QueueExitCriteria.UniqueMemberIds(input, "drawOrder");
        var isPermutation = order is { } drawn
            && drawn.Length == candidates.MemberIds.Length
            && drawn.All(memberId => candidates.MemberIds.Contains(memberId, StringComparer.Ordinal));
        return isPermutation ? [.. order!.Value.Take(candidates.Count)] : null;
    }
}

/// <summary>Exactly as many as leave, all of the losing team.</summary>
internal sealed class ManualCriterion : IQueueExitCriterion
{
    public static readonly ManualCriterion Instance = new();

    private ManualCriterion()
    {
    }

    public ImmutableArray<string>? Choose(QueueExitCandidates candidates, RawObject input)
    {
        var choice = QueueExitCriteria.UniqueMemberIds(input, "chosen");
        var isValid = choice is { } chosen
            && chosen.Length == candidates.Count
            && chosen.All(memberId => candidates.MemberIds.Contains(memberId, StringComparer.Ordinal));
        return isValid ? choice : null;
    }
}

/// <summary>The criteria by key, compared by UTF-16 code unit: a <c>switch</c>, never a dictionary (ADR 0033, D10).</summary>
internal static class QueueExitCriteria
{
    /// <summary>
    /// Who leaves, by the criterion, in its order; <c>null</c> for an unknown criterion or an input that
    /// does not choose exactly <c>Count</c> members of the losing team.
    /// </summary>
    public static ImmutableArray<string>? ChooseOutgoing(QueueSideChoice choice, QueueExitCandidates candidates) =>
        (Of(choice.Criterion), choice.CriterionInput) is ({ } criterion, RawObject input)
            ? criterion.Choose(candidates, input)
            : null;

    /// <summary>The arrival order of the candidates, which must all be in it; others are ignored.</summary>
    internal static ImmutableArray<string>? ArrivalOrder(RawObject input, QueueExitCandidates candidates) =>
        UniqueMemberIds(input, "arrivalOrder") is { } order
        && candidates.MemberIds.All(memberId => order.Contains(memberId, StringComparer.Ordinal))
            ? [.. order.Where(memberId => candidates.MemberIds.Contains(memberId, StringComparer.Ordinal))]
            : null;

    /// <summary>A list of members of the input: UUIDs, each one once, of any size, or <c>null</c>.</summary>
    internal static ImmutableArray<string>? UniqueMemberIds(RawObject input, string key) =>
        PayloadValues.UniqueMemberIds(PayloadValues.Member(input, key), 0, int.MaxValue);

    private static IQueueExitCriterion? Of(RawValue criterion) => criterion is RawString { Value: var key }
        ? key switch
        {
            QueueExitLimits.ConsecutiveMatches => ConsecutiveMatchesCriterion.Instance,
            QueueExitLimits.ArrivalOrder => ArrivalOrderCriterion.Instance,
            QueueExitLimits.Draw => DrawCriterion.Instance,
            QueueExitLimits.Manual => ManualCriterion.Instance,
            _ => null,
        }
        : null;
}
