namespace Sacou.Modules.Identity.Domain.Accounts;

/// <summary>The account deletion rules (E3.16, ADR 0056, D4).</summary>
internal static class AccountRules
{
    /// <summary>
    /// How old the last real sign-in may be to delete the account: also the window in which Firebase accepts
    /// <c>user.delete()</c> on the phone without asking for the password again.
    /// </summary>
    public static readonly TimeSpan RecentLoginWindow = TimeSpan.FromMinutes(5);
}
