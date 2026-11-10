using Sacou.Modules.Groups.Domain.Members;

namespace Sacou.Modules.Groups.Domain.Invites;

/// <summary>
/// An invite link of a group (ADR 0040, D10): many uses, valid until revoked or past <see cref="ExpiresAt"/>.
/// <see cref="UseCount"/> counts who came in through it, never who was already an active member.
/// </summary>
internal sealed record GroupInvite(
    InviteId Id,
    InviteTokenHash TokenHash,
    MemberId CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset? RevokedAt,
    int UseCount)
{
    public static GroupInvite Create(InviteId id, InviteTokenHash tokenHash, MemberId createdBy, DateTimeOffset now) =>
        new(id, tokenHash, createdBy, now, InviteRules.ExpiresAt(now), RevokedAt: null, UseCount: 0);

    /// <summary>Expired from the very instant of <see cref="ExpiresAt"/> on.</summary>
    public bool IsValidAt(DateTimeOffset now) => RevokedAt is null && (ExpiresAt is not { } expiry || now < expiry);

    public bool IsRevoked => RevokedAt is not null;

    public GroupInvite Revoke(DateTimeOffset now) => this with { RevokedAt = now };

    public GroupInvite CountUse() => this with { UseCount = UseCount + 1 };
}
