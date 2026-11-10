namespace Sacou.Modules.Groups.Domain.Settings;

/// <summary>
/// The closed list of refusals, the same as in TypeScript. The API answers all of them as
/// <c>groups.settings-invalid</c>, without the path (ADR 0039); the app shows the path.
/// </summary>
internal static class SettingsErrors
{
    public const string UnknownField = "settings.unknown-field";
    public const string MissingField = "settings.missing-field";
    public const string WrongType = "settings.wrong-type";
    public const string OutOfRange = "settings.out-of-range";
    public const string UnknownValue = "settings.unknown-value";
    public const string InvalidText = "settings.invalid-text";
    public const string NotAllowedAtLevel = "settings.not-allowed-at-level";
    public const string UnsupportedVersion = "settings.unsupported-version";

    /// <summary>The path of the root, which has none of its own.</summary>
    public const string RootPath = "";

    public const string SchemaVersionKey = "schemaVersion";

    public const char PathSeparator = '.';
}

/// <summary>A refusal with the leaf or block it is about; for an unknown key, its parent.</summary>
internal sealed record SettingsError(string Code, string Path);

/// <summary>Local and closed, like <c>OverlapResult</c> (ADR 0025): the <c>Error</c> of Shared has no path.</summary>
internal sealed class SettingsResult<T>
    where T : class
{
    private readonly T? _value;
    private readonly SettingsError? _error;

    private SettingsResult(T? value, SettingsError? error)
    {
        _value = value;
        _error = error;
    }

    public bool IsSuccess => _error is null;

    public T Value => _value ?? throw new InvalidOperationException("A failed result has no value.");

    public SettingsError Error => _error ?? throw new InvalidOperationException("A successful result has no error.");

    public static SettingsResult<T> Success(T value) => new(value, null);

    public static SettingsResult<T> Failure(SettingsError error) => new(null, error);
}
