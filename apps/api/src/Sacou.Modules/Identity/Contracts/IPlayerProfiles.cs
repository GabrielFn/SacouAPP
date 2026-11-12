namespace Sacou.Modules.Identity.Contracts;

/// <summary>
/// The profiles of many people at once, for the other modules (ADR 0051, D5): the member list asks for the
/// nickname and the positions of its members by user id, in one query, without reading the Identity schema.
/// The Identity module never learns about groups.
/// </summary>
public interface IPlayerProfiles
{
    /// <summary>One view per user that saved a profile, in no given order; a user without one is absent.</summary>
    Task<IReadOnlyList<PlayerProfileView>> FindManyAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken);
}
