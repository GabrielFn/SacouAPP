using Sacou.Shared.Members;

namespace Sacou.Modules.Groups.Domain.Guests;

/// <summary>What the admin types about a guest: the name and, optionally, the position (screen 21a).</summary>
internal sealed record GuestProfile(GuestName Name, GuestPosition? Position);

/// <summary>
/// The profile of a member without an account (ADR 0053, D1 and D2), kept apart from the member so no read of
/// <c>groups.members</c> ever carries a name. <see cref="RequestId"/> makes the creation idempotent (D5) and never
/// leaves the server. No author, by minimization.
/// </summary>
internal sealed record Guest(MemberId MemberId, GuestProfile Profile, Guid RequestId, DateTimeOffset CreatedAt);

/// <summary>
/// A correction of the profile (ADR 0053, D9). A null <see cref="Name"/> keeps the name; <see cref="ChangesPosition"/>
/// false keeps the position, and true with a null <see cref="Position"/> clears it.
/// </summary>
internal sealed record GuestCorrection(GuestName? Name, bool ChangesPosition, GuestPosition? Position)
{
    public bool IsEmpty => Name is null && !ChangesPosition;

    public GuestProfile ApplyTo(GuestProfile profile) =>
        new(Name ?? profile.Name, ChangesPosition ? Position : profile.Position);
}
