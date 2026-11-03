using System.Collections.Immutable;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

namespace Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;

/// <summary>
/// One key of a closed payload schema: a leaf, a nested object, or a list whose items all have one
/// shape. Port of <c>PayloadShape</c> in <c>score/types.ts</c>.
/// </summary>
internal sealed record PayloadShapeField(string Key, PayloadShape? Nested, PayloadShape? ListItem)
{
    public static PayloadShapeField Leaf(string key) => new(key, null, null);

    public static PayloadShapeField Nest(string key, params PayloadShapeField[] fields) => new(key, PayloadShape.Of(fields), null);

    public static PayloadShapeField ListOf(string key, params PayloadShapeField[] fields) => new(key, null, PayloadShape.Of(fields));
}

/// <summary>The keys of one level of a payload, in the order the parser checks them.</summary>
internal sealed record PayloadShape(ImmutableArray<PayloadShapeField> Fields)
{
    public static PayloadShape Of(params PayloadShapeField[] fields) => new([.. fields]);

    /// <summary>
    /// Whether any level of the payload has a key outside the schema, or a key twice. A child of the
    /// wrong type has no keys to report: its own field check rejects it. Recursion is bounded by the
    /// depth of the schema, never by the input.
    /// </summary>
    public bool HasUnknownKey(RawObject record)
    {
        var hasRepeatedKey = record.Members.DistinctBy(member => member.Key, StringComparer.Ordinal).Count() != record.Members.Length;
        return hasRepeatedKey || record.Members.Any(member => !TryGetField(member.Key, out var field) || HasUnknownChildKey(member.Value, field));
    }

    private static bool HasUnknownChildKey(RawValue child, PayloadShapeField field) => (field, child) switch
    {
        ({ Nested: { } nested }, RawObject record) => nested.HasUnknownKey(record),
        ({ ListItem: { } itemShape }, RawArray items) => items.Items.Any(item => item is RawObject record && itemShape.HasUnknownKey(record)),
        _ => false,
    };

    private bool TryGetField(string key, out PayloadShapeField field)
    {
        foreach (var candidate in Fields)
        {
            if (string.Equals(candidate.Key, key, StringComparison.Ordinal))
            {
                field = candidate;
                return true;
            }
        }

        field = PayloadShapeField.Leaf(key);
        return false;
    }
}
