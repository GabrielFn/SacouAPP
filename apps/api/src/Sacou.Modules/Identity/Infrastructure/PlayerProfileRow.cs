using Sacou.Modules.Identity.Domain.Users;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// A row of <c>identity.player_profiles</c>. Persistence shape only: the domain never sees it. The key is the
/// <see cref="Domain.Users.UserId"/> of <c>identity.users</c>, with the same conversion, so EF can tie the two.
/// </summary>
internal sealed class PlayerProfileRow
{
    public required UserId UserId { get; init; }

    public required string Nickname { get; init; }

    public string? PrimaryPosition { get; init; }

    public required string[] OtherPositions { get; init; }

    public short? SuggestedLevelTenths { get; init; }

    public required DateTimeOffset UpdatedAt { get; init; }
}
