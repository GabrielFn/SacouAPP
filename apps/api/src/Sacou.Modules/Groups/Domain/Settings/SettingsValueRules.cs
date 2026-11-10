using System.Text.RegularExpressions;

namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>The rule of each value type, the same as value-rules.ts. Each returns the refusal, or <c>null</c>.</summary>
internal static partial class SettingsValueRules
{
    private const int LastHour = 23;
    private const int LastMinute = 59;
    private const int HourGroup = 1;
    private const int MinuteGroup = 2;
    private const int DecimalBase = 10;

    public static string? Check(SettingsField field, SettingsNode node) => field.Type switch
    {
        SettingsValueType.Boolean => node is BooleanNode ? null : SettingsErrors.WrongType,
        SettingsValueType.Integer => CheckInteger(field, node),
        SettingsValueType.Choice => CheckChoice(field, node),
        SettingsValueType.Time => CheckTime(node),
        _ => node is TextNode text ? SettingsText.Check(text.Value, field.MaxLength) : SettingsErrors.WrongType,
    };

    /// <summary>A finite double with no fraction: <c>25.0</c> is 25, as JSON.parse reads it (ADR 0025).</summary>
    private static string? CheckInteger(SettingsField field, SettingsNode node)
    {
        if (node is not NumberNode { Value: var value } || !double.IsFinite(value) || Math.Floor(value) != value)
        {
            return SettingsErrors.WrongType;
        }

        return value >= field.Min && value <= field.Max ? null : SettingsErrors.OutOfRange;
    }

    /// <summary>The type comes from the list: numbers for <c>bestOf</c>, text for the system.</summary>
    private static string? CheckChoice(SettingsField field, SettingsNode node)
    {
        var expectsNumber = field.Values[0].Kind == SettingsValueKind.Number;
        var hasType = expectsNumber
            ? node is NumberNode { Value: var number } && double.IsFinite(number)
            : node is TextNode;
        if (!hasType)
        {
            return SettingsErrors.WrongType;
        }

        return SettingsValue.FromNode(node) is { } value && field.Values.Contains(value) ? null : SettingsErrors.UnknownValue;
    }

    private static string? CheckTime(SettingsNode node)
    {
        var shape = node is TextNode text ? TimeShape().Match(text.Value) : Match.Empty;
        if (!shape.Success)
        {
            return SettingsErrors.WrongType;
        }

        var isInRange = TwoDigits(shape.Groups[HourGroup].Value) <= LastHour
            && TwoDigits(shape.Groups[MinuteGroup].Value) <= LastMinute;
        return isInRange ? null : SettingsErrors.OutOfRange;
    }

    /// <summary>ASCII digits only, already checked by the pattern: no culture involved.</summary>
    private static int TwoDigits(string digits) => ((digits[0] - '0') * DecimalBase) + (digits[1] - '0');

    /// <summary><c>HH:mm</c>. <c>[0-9]</c>, never <c>\d</c>, which takes any Unicode digit in .NET; <c>\z</c>, never <c>$</c>, which takes a final line break.</summary>
    [GeneratedRegex(@"^([0-9]{2}):([0-9]{2})\z", RegexOptions.CultureInvariant, matchTimeoutMilliseconds: 100)]
    private static partial Regex TimeShape();
}
