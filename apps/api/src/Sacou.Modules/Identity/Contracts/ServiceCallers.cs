namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// The routes Google calls, never a person (ADR 0069, D11): Cloud Tasks and Cloud Scheduler, with a Google OIDC token of
/// the one account allowed. A route takes <see cref="Policy"/> instead of the Firebase login; any refusal is the same 401.
/// </summary>
public static class ServiceCallers
{
    /// <summary>The authorization policy of those routes. It reads only the service caller scheme, never the Firebase one.</summary>
    public const string Policy = "service-caller";

    /// <summary>The authentication scheme behind <see cref="Policy"/>.</summary>
    public const string AuthenticationScheme = "GoogleServiceCaller";
}
