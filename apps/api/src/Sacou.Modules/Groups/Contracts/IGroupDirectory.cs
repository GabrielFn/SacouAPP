namespace Sacou.Modules.Groups.Contracts;

/// <summary>
/// What anyone holding a round's public link may know of its group (E3.12, ADR 0070, D1): the name only, read
/// without a lock. Never the members, their number or anything about a person.
/// </summary>
public interface IGroupDirectory
{
    /// <summary>The group's current name, or null when the group does not exist.</summary>
    Task<string?> FindNameAsync(Guid groupId, CancellationToken cancellationToken);
}
