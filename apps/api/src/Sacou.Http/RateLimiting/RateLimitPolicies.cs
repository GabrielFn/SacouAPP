using System.Collections.Frozen;

namespace Sacou.Http.RateLimiting;

/// <summary>The names of the per-route rate limit policies (ADR 0062, D3). Every route on top of the global limit.</summary>
public static class RateLimitPolicies
{
    /// <summary>Not a route policy: the name of the limit every signed-in route goes through, used in messages only.</summary>
    public const string Global = "global";

    public const string SignIn = "sign-in";
    public const string Invite = "invite";
    public const string GroupCreate = "group-create";
    public const string InviteCreate = "invite-create";
    public const string Draw = "draw";
    public const string MemberLevels = "member-levels";
    public const string AccountExport = "account-export";
    public const string AccountDelete = "account-delete";
    public const string CourtSync = "court-sync";
    public const string RoundLink = "round-link";

    /// <summary>The phone registration of the push (E3.11, ADR 0069, D8).</summary>
    public const string PushDevice = "push-device";

    /// <summary>The content report of E6.6: per user, 10 a minute, so one account cannot flood the operator with reports.</summary>
    public const string Report = "report";

    /// <summary>The anonymous round page (ADR 0070, D6): per client address, never per user.</summary>
    public const string RoundPage = "round-page";

    /// <summary>The operator's counts (E7.2, ADR 0085, D3): per user, 20 a minute.</summary>
    public const string Ops = "ops";
    /// <summary>The anonymous app config the app asks before the sign-in (ADR 0084): per client address, as a JSON answer.</summary>
    public const string AppConfig = "app-config";

    /// <summary>The policies whose partition is the client's address (hashed), because their visitor is anonymous.</summary>
    public static readonly FrozenSet<string> PerClientAddress = FrozenSet.Create(StringComparer.Ordinal, RoundPage, AppConfig);

    /// <summary>The policies whose 429 is a short HTML page for a person, not a JSON problem.</summary>
    public static readonly FrozenSet<string> AnswerWithPage = FrozenSet.Create(StringComparer.Ordinal, RoundPage);

    /// <summary>
    /// The routes whose request holds two connections of the pool at once (ADR 0056, D7a): they also share one
    /// concurrency limit, so they never take the whole pool (ADR 0062, D4).
    /// </summary>
    public static readonly FrozenSet<string> DualConnection = FrozenSet.Create(StringComparer.Ordinal, Invite, GroupCreate, RoundLink);
}
