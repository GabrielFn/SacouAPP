namespace Sacou.Modules.Groups.Domain.Invites;

/// <summary>
/// Gabriel's answers 17 and 18 (09/11/2026): a link is valid until revoked, and whoever has it comes in
/// without approval. A lifetime here (say 30 days) would change only this constant and one test.
/// </summary>
internal static class InviteRules
{
    /// <summary>Null: no expiry. The <c>expires_at</c> column is checked anyway, from the first day.</summary>
    public static TimeSpan? DefaultLifetime => null;

    public const int MaxActiveInvites = GroupLimits.MaxActiveInvitesPerGroup;

    public static DateTimeOffset? ExpiresAt(DateTimeOffset now) => now + DefaultLifetime;
}
