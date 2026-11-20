using Sacou.Shared.Results;

namespace Sacou.Modules.Notifications.Domain;

/// <summary>
/// An Expo push token, <c>ExponentPushToken[...]</c> or <c>ExpoPushToken[...]</c>, up to <see cref="MaxLength"/>
/// visible ASCII characters (ADR 0069, D8). A personal datum and the capability to reach the phone: its
/// <see cref="ToString"/> never prints it.
/// </summary>
internal sealed record PushToken
{
    public const int MaxLength = 200;

    private const char FirstVisible = '!';
    private const char LastVisible = '~';
    private const char Open = '[';
    private const char Close = ']';

    private static readonly string[] Prefixes = ["ExponentPushToken[", "ExpoPushToken["];

    private PushToken(string value) => Value = value;

    public string Value { get; }

    public static Result<PushToken> Parse(string? text) =>
        text is not null && IsWellFormed(text) ? Result.Success(new PushToken(text)) : Result.Failure<PushToken>(NotificationErrors.TokenInvalid);

    public override string ToString() => "PushToken { Value = *** }";

    private static bool IsWellFormed(string text)
    {
        if (text.Length > MaxLength || !text.All(character => character is >= FirstVisible and <= LastVisible) || !text.EndsWith(Close))
        {
            return false;
        }

        var prefix = Array.Find(Prefixes, candidate => text.StartsWith(candidate, StringComparison.Ordinal));
        if (prefix is null)
        {
            return false;
        }

        var inner = text[prefix.Length..^1];
        return inner.Length > 0 && !inner.Contains(Open, StringComparison.Ordinal) && !inner.Contains(Close, StringComparison.Ordinal);
    }
}
