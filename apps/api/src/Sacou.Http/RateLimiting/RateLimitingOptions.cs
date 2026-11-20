namespace Sacou.Http.RateLimiting;

/// <summary>One fixed window: at most <see cref="PermitLimit"/> requests per user (or per client address) in <see cref="WindowSeconds"/>.</summary>
public sealed class WindowLimitOptions
{
    public int PermitLimit { get; init; }

    public int WindowSeconds { get; init; }

    public TimeSpan Window => TimeSpan.FromSeconds(WindowSeconds);
}

/// <summary>
/// The <c>RateLimiting</c> section (ADR 0062, D6): the global window, one window per route policy and the
/// concurrency of the routes that hold two connections. Every value comes from configuration; a missing or
/// non-positive one stops the start.
/// </summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    private const int ConnectionsPerDualRequest = 2;

    public WindowLimitOptions? Global { get; init; }

    public WindowLimitOptions? SignIn { get; init; }

    public WindowLimitOptions? Invite { get; init; }

    public WindowLimitOptions? GroupCreate { get; init; }

    public WindowLimitOptions? InviteCreate { get; init; }

    public WindowLimitOptions? Draw { get; init; }

    public WindowLimitOptions? MemberLevels { get; init; }

    public WindowLimitOptions? AccountExport { get; init; }

    public WindowLimitOptions? AccountDelete { get; init; }

    public WindowLimitOptions? CourtSync { get; init; }

    public WindowLimitOptions? RoundLink { get; init; }

    public WindowLimitOptions? PushDevice { get; init; }

    /// <summary>Per client address, not per user: the round page is anonymous (ADR 0070, D6).</summary>
    public WindowLimitOptions? RoundPage { get; init; }

    /// <summary>How many requests of the two-connection routes run at once, for everyone together.</summary>
    public int DualConnectionConcurrency { get; init; }

    /// <summary>How many more of them wait for a turn, oldest first, before a 429.</summary>
    public int DualConnectionQueue { get; init; }

    /// <summary>
    /// How many requests of the two-connection routes one user runs at once. The shared gate is taken only after this
    /// one, so an account that sends its bodies slowly holds at most this many places of everyone's gate.
    /// </summary>
    public int DualConnectionPerUser { get; init; }

    /// <summary>How many more requests of one user wait for that user's turn, holding no place of the shared gate, before a 429.</summary>
    public int DualConnectionPerUserQueue { get; init; }

    /// <summary>Connections of the pool kept for every other route, on top of the two per running request.</summary>
    public int DualConnectionHeadroom { get; init; }

    /// <summary>The connections the two-connection routes may hold at most, plus the headroom.</summary>
    public int DualConnectionPoolNeed => (ConnectionsPerDualRequest * DualConnectionConcurrency) + DualConnectionHeadroom;

    /// <summary>Each route policy by name, the global window under <see cref="RateLimitPolicies.Global"/>.</summary>
    public IReadOnlyDictionary<string, WindowLimitOptions?> Windows() => new Dictionary<string, WindowLimitOptions?>(StringComparer.Ordinal)
    {
        [RateLimitPolicies.Global] = Global,
        [RateLimitPolicies.SignIn] = SignIn,
        [RateLimitPolicies.Invite] = Invite,
        [RateLimitPolicies.GroupCreate] = GroupCreate,
        [RateLimitPolicies.InviteCreate] = InviteCreate,
        [RateLimitPolicies.Draw] = Draw,
        [RateLimitPolicies.MemberLevels] = MemberLevels,
        [RateLimitPolicies.AccountExport] = AccountExport,
        [RateLimitPolicies.AccountDelete] = AccountDelete,
        [RateLimitPolicies.CourtSync] = CourtSync,
        [RateLimitPolicies.RoundLink] = RoundLink,
        [RateLimitPolicies.PushDevice] = PushDevice,
        [RateLimitPolicies.RoundPage] = RoundPage,
    };
}
