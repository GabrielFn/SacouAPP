namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>A leaf value: a boolean, a finite number or a text. A leaf is never null (ADR 0041).</summary>
internal sealed record SettingsValue
{
    private SettingsValue(SettingsValueKind kind, bool boolean, double number, string text)
    {
        Kind = kind;
        Boolean = boolean;
        Number = number;
        Text = text;
    }

    public SettingsValueKind Kind { get; }

    public bool Boolean { get; }

    public double Number { get; }

    public string Text { get; }

    public static SettingsValue Of(bool value) => new(SettingsValueKind.Boolean, value, 0, string.Empty);

    public static SettingsValue Of(double value) => new(SettingsValueKind.Number, false, value, string.Empty);

    public static SettingsValue Of(string value) => new(SettingsValueKind.Text, false, 0, value);

    /// <summary>A scalar node as a value; <c>null</c> for anything else.</summary>
    public static SettingsValue? FromNode(SettingsNode? node) => node switch
    {
        BooleanNode boolean => Of(boolean.Value),
        NumberNode number => Of(number.Value),
        TextNode text => Of(text.Value),
        _ => null,
    };

    public SettingsNode ToNode() => Kind switch
    {
        SettingsValueKind.Boolean => new BooleanNode(Boolean),
        SettingsValueKind.Number => new NumberNode(Number),
        _ => new TextNode(Text),
    };

    /// <summary>The venue may name a person: never printed.</summary>
    public override string ToString() => nameof(SettingsValue);
}

internal enum SettingsValueKind
{
    Boolean,
    Number,
    Text,
}
