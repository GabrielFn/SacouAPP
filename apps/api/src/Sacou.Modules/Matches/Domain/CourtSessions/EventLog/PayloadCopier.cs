using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// Port of the payload copy in <c>parse-envelope.ts</c>: the same depth and node limits, counted the
/// same way, with keys sorted by UTF-16 code unit at every level so that a resend with its keys in
/// another order yields the same payload. Unlike JavaScript, which keeps the last one, a repeated
/// key fails the copy (ADR 0033, D3). Sizes are checked before walking, so a huge list costs nothing.
/// </summary>
internal static class PayloadCopier
{
    private const int PayloadDepth = 1;

    /// <summary>Returns the copy, or null for anything the limits bar or JSON cannot represent.</summary>
    public static RawObject? Copy(RawValue value)
    {
        var budget = new NodeBudget(EventLogSchema.MaxPayloadNodes);
        return value is RawObject payload && budget.TrySpendOne() ? CopyObject(payload, PayloadDepth, budget) : null;
    }

    /// <summary>Spends a node, then copies; any failure empties the budget, so siblings cost no more work.</summary>
    private static RawValue? CopyValue(RawValue value, int depth, NodeBudget budget)
    {
        if (!budget.TrySpendOne())
        {
            return null;
        }

        var copy = CopyAllowedValue(value, depth, budget);
        if (copy is null)
        {
            budget.Exhaust();
        }

        return copy;
    }

    private static RawValue? CopyAllowedValue(RawValue value, int depth, NodeBudget budget) => value switch
    {
        RawNull or RawBoolean or RawString => value,
        RawNumber number => double.IsFinite(number.Value) ? number : null,
        _ when depth > EventLogSchema.MaxPayloadDepth => null,
        RawArray array => CopyArray(array, depth, budget),
        RawObject record => CopyObject(record, depth, budget),
        _ => null,
    };

    private static RawArray? CopyArray(RawArray array, int depth, NodeBudget budget)
    {
        if (array.Items.Length > budget.Remaining)
        {
            return null;
        }

        var items = ImmutableArray.CreateBuilder<RawValue>(array.Items.Length);
        foreach (var item in array.Items)
        {
            var copy = CopyValue(item, depth + 1, budget);
            if (copy is null)
            {
                return null;
            }

            items.Add(copy);
        }

        return new RawArray(items.MoveToImmutable());
    }

    private static RawObject? CopyObject(RawObject record, int depth, NodeBudget budget)
    {
        if (record.Members.Length > budget.Remaining)
        {
            return null;
        }

        var sorted = record.Members.Sort(static (left, right) => string.CompareOrdinal(left.Key, right.Key));
        if (HasRepeatedKey(sorted))
        {
            return null;
        }

        var members = ImmutableArray.CreateBuilder<RawMember>(sorted.Length);
        foreach (var member in sorted)
        {
            var copy = CopyValue(member.Value, depth + 1, budget);
            if (copy is null)
            {
                return null;
            }

            members.Add(new RawMember(member.Key, copy));
        }

        return new RawObject(members.MoveToImmutable());
    }

    /// <summary>After an ordinal sort, equal keys sit side by side; the escape was already undone.</summary>
    private static bool HasRepeatedKey(ImmutableArray<RawMember> sorted)
    {
        for (var index = 1; index < sorted.Length; index++)
        {
            if (string.Equals(sorted[index - 1].Key, sorted[index].Key, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>The one mutable value of the copy: threading it through would make the copy quadratic.</summary>
    private sealed class NodeBudget(int remaining)
    {
        public int Remaining { get; private set; } = remaining;

        public bool TrySpendOne()
        {
            if (Remaining <= 0)
            {
                return false;
            }

            Remaining--;
            return true;
        }

        public void Exhaust() => Remaining = 0;
    }
}
