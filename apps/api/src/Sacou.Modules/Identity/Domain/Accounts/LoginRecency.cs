namespace Sacou.Modules.Identity.Domain.Accounts;

/// <summary>Whether the last real sign-in is recent enough to delete the account (ADR 0056, D4). Pure: the clock comes in.</summary>
internal static class LoginRecency
{
    /// <summary>
    /// True up to <see cref="AccountRules.RecentLoginWindow"/> included. A sign-in slightly in the future (the clock
    /// drift the token rules already allow) counts as recent.
    /// </summary>
    public static bool IsRecent(DateTimeOffset authenticatedAt, DateTimeOffset now) =>
        now - authenticatedAt <= AccountRules.RecentLoginWindow;
}
