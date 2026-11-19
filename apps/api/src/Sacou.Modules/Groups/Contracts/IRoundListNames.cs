namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// The names on a round's public list (E3.12, question 126, option 2: the first names for everyone holding the link,
/// as on screen 01; ADR 0070, D5). Only the nickname (or a guest's name) and whether the member is a mensalista:
/// never the member id, the user, a position or a level.
/// </summary>
public interface IRoundListNames
{
    /// <summary>
    /// One entry per active member of the group among <paramref name="memberIds"/>; a member who left or a stranger is
    /// absent. The key is only for the caller to put the list in order, and never leaves the server.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, ListName>> FindAsync(Guid groupId, IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken);
}

/// <summary>What the public list shows of one member: the nickname, null without a profile, and the mensalista mark.</summary>
public sealed record ListName(string? Nickname, bool Regular);
