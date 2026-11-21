namespace Sacou.Modules.Identity.Authentication;

/// <summary>
/// Who may call the internal routes (ADR 0069, D11): section <c>ServiceCaller</c>, not secret. <see cref="Audience"/> is
/// the service's own URL (the <c>aud</c> Cloud Tasks puts in the token) and <see cref="Email"/> the account that calls
/// (<c>sacou-tasks-invoker</c>). Missing either one, every call is refused: the routes stay closed, the API runs.
/// </summary>
internal sealed class ServiceCallerOptions
{
    public const string SectionName = "ServiceCaller";

    public string Audience { get; init; } = string.Empty;

    public string Email { get; init; } = string.Empty;

    public bool IsConfigured =>
        Uri.TryCreate(Audience, UriKind.Absolute, out var audience) && audience.Scheme == Uri.UriSchemeHttps && Email.Contains('@', StringComparison.Ordinal);
}
