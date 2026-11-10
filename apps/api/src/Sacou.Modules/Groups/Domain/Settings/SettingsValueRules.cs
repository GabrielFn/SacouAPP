namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>The rule of each value type, the same as value-rules.ts. Each returns the refusal, or <c>null</c>.</summary>
internal static class SettingsValueRules
{
    private const int LastHour = 23;
    private const int LastMinute = 59;
    private const int TimeLength = 5;
    private const int HourStart = 0;
    private const int SeparatorIndex = 2;
    private const int MinuteStart = 3;
    private const char TimeSeparator = ':';
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

    /// <summary><c>HH:mm</c> with ASCII digits only: no regex, whose generated code the domain cannot reference, and no culture.</summary>
    private static string? CheckTime(SettingsNode node)
    {
        if (node is not TextNode { Value: var text } || !HasTimeShape(text))
        {
            return SettingsErrors.WrongType;
        }

        var isInRange = TwoDigits(text, HourStart) <= LastHour && TwoDigits(text, MinuteStart) <= LastMinute;
        return isInRange ? null : SettingsErrors.OutOfRange;
    }

    private static bool HasTimeShape(string text) =>
        text.Length == TimeLength
        && text[SeparatorIndex] == TimeSeparator
        && char.IsAsciiDigit(text[HourStart]) && char.IsAsciiDigit(text[HourStart + 1])
        && char.IsAsciiDigit(text[MinuteStart]) && char.IsAsciiDigit(text[MinuteStart + 1]);

    private static int TwoDigits(string text, int start) => ((text[start] - '0') * DecimalBase) + (text[start + 1] - '0');
}
