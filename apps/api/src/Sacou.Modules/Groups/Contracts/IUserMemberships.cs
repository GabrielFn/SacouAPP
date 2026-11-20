namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// Every group the person has or had a member in, for the sums of their own profile (E3.9, screens 14 and 15): the
/// member id, when it joined and left, and the name and modality of the group. Never anyone else's membership.
/// </summary>
public interface IUserMemberships
{
    /// <summary>Oldest first, in any status (active, left, removed); empty for a person in no group.</summary>
    Task<IReadOnlyList<UserMembership>> ListAsync(Guid userId, CancellationToken cancellationToken);
}

/// <summary>
/// One membership of the person: <see cref="LeftAt"/> is null while active. <see cref="Modality"/> is the group's
/// own <c>format.modality</c> (the chip "Quadra 6x6"), not a round's.
/// </summary>
public sealed record UserMembership(
    Guid GroupId, string GroupName, Guid MemberId, bool Active, DateTimeOffset JoinedAt, DateTimeOffset? LeftAt, GameModality Modality)
{
    /// <summary>The group name is shown to the person only: never printed.</summary>
    public override string ToString() => nameof(UserMembership);
}
