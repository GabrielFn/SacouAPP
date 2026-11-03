using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// A JSON value as received, owned by the domain so that the rules never touch System.Text.Json
/// (ADR 0033, D2). Objects keep their members in the order received, repeated keys included: the
/// parser decides about them. Immutable, so a value can be shared between copies.
/// </summary>
internal abstract class RawValue
{
    private protected RawValue()
    {
    }
}

internal sealed class RawNull : RawValue
{
    public static readonly RawNull Instance = new();

    private RawNull()
    {
    }
}

internal sealed class RawBoolean : RawValue
{
    public static readonly RawBoolean True = new(value: true);
    public static readonly RawBoolean False = new(value: false);

    private RawBoolean(bool value) => Value = value;

    public bool Value { get; }

    public static RawBoolean Of(bool value) => value ? True : False;
}

/// <summary>Always a double, as in JavaScript. Not finite when the text did not fit one: the parser refuses it.</summary>
internal sealed class RawNumber(double value) : RawValue
{
    public double Value { get; } = value;
}

/// <summary>UTF-16 text as decoded, which may hold a lone surrogate, as in JavaScript.</summary>
internal sealed class RawString(string value) : RawValue
{
    public string Value { get; } = value;
}

internal sealed class RawArray(ImmutableArray<RawValue> items) : RawValue
{
    public ImmutableArray<RawValue> Items { get; } = items;
}

internal sealed record RawMember(string Key, RawValue Value);

internal sealed class RawObject(ImmutableArray<RawMember> members) : RawValue
{
    public static readonly RawObject Empty = new([]);

    public ImmutableArray<RawMember> Members { get; } = members;

    /// <summary>
    /// The first member with that key, compared by UTF-16 code unit. Absent is not <see cref="RawNull"/>:
    /// this is the <c>readOwn</c> of the TypeScript port.
    /// </summary>
    public bool TryGetMember(string key, out RawValue value)
    {
        foreach (var member in Members)
        {
            if (string.Equals(member.Key, key, StringComparison.Ordinal))
            {
                value = member.Value;
                return true;
            }
        }

        value = RawNull.Instance;
        return false;
    }
}
