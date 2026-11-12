using System.Collections.Immutable;

namespace Sacou.Shared.Persistence;

/// <summary>
/// Helpers for enums stored as hand-written text, so reordering or renaming an enum never changes stored data.
/// The module's <c>ColumnValues</c> holds the dictionaries; the CHECK constraints are built from the same lists.
/// </summary>
public static class EnumColumns
{
    public static TEnum Parse<TEnum>(ImmutableDictionary<TEnum, string> values, string text)
        where TEnum : struct, Enum
    {
        ArgumentNullException.ThrowIfNull(values);
        return values.Single(pair => pair.Value == text).Key;
    }

    /// <summary>The SQL list for a CHECK, such as <c>'admin', 'co_admin'</c>, in a fixed order.</summary>
    public static string SqlList<TEnum>(ImmutableDictionary<TEnum, string> values)
        where TEnum : struct, Enum
    {
        ArgumentNullException.ThrowIfNull(values);
        return string.Join(", ", values.Values.Order(StringComparer.Ordinal).Select(value => $"'{value}'"));
    }
}
