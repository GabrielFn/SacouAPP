using Microsoft.EntityFrameworkCore;
using Sacou.Modules.Identity.Domain.Profiles;
using Sacou.Modules.Identity.Domain.Users;
using Sacou.Shared.Levels;

namespace Sacou.Modules.Identity.Infrastructure;

/// <summary>
/// Reads with no tracking; writes in one parameterized <c>INSERT ... ON CONFLICT DO UPDATE</c>, so sixteen first
/// saves at once leave one row and no exception (ADR 0037, D6; ADR 0051, D10).
/// </summary>
internal sealed class PostgresPlayerProfileStore(IdentityDbContext database) : IPlayerProfileStore
{
    public async Task<PlayerProfile?> FindAsync(UserId user, CancellationToken cancellationToken)
    {
        var row = await database.PlayerProfiles.AsNoTracking()
            .SingleOrDefaultAsync(profile => profile.UserId == user, cancellationToken)
            .ConfigureAwait(false);
        return row is null ? null : ToDomain(row);
    }

    public async Task UpsertAsync(PlayerProfile profile, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(profile);
        var row = ToRow(profile);
        await database.Database
            .ExecuteSqlAsync(
                $"""
                INSERT INTO identity.player_profiles (user_id, nickname, primary_position, other_positions, suggested_level_tenths, updated_at)
                VALUES ({row.UserId.Value}, {row.Nickname}, {row.PrimaryPosition}, {row.OtherPositions}, {row.SuggestedLevelTenths}, {row.UpdatedAt})
                ON CONFLICT (user_id) DO UPDATE SET
                    nickname = EXCLUDED.nickname,
                    primary_position = EXCLUDED.primary_position,
                    other_positions = EXCLUDED.other_positions,
                    suggested_level_tenths = EXCLUDED.suggested_level_tenths,
                    updated_at = EXCLUDED.updated_at
                """,
                cancellationToken)
            .ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<PlayerProfile>> FindManyAsync(IReadOnlyCollection<Guid> users, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(users);
        if (users.Count == 0)
        {
            return [];
        }

        UserId[] ids = [.. users.Distinct().Select(user => new UserId(user))];
        var rows = await database.PlayerProfiles.AsNoTracking()
            .Where(profile => ids.Contains(profile.UserId))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return [.. rows.Select(ToDomain)];
    }

    private static PlayerProfileRow ToRow(PlayerProfile profile) => new()
    {
        UserId = profile.UserId,
        Nickname = profile.Nickname.Value,
        PrimaryPosition = profile.Positions.Primary is { } primary ? ProfileColumnValues.PrimaryPositions[primary] : null,
        OtherPositions = [.. profile.Positions.Others.Select(position => ProfileColumnValues.Positions[position])],
        SuggestedLevelTenths = profile.SuggestedLevel is { } level ? checked((short)level.Tenths) : null,
        UpdatedAt = profile.UpdatedAt,
    };

    /// <summary>The CHECK constraints guarantee the values, so a stored row always converts.</summary>
    private static PlayerProfile ToDomain(PlayerProfileRow row) => new(
        row.UserId,
        Nickname.FromStored(row.Nickname),
        PlayerPositions.FromStored(
            row.PrimaryPosition is { } primary ? ProfileColumnValues.Parse(ProfileColumnValues.PrimaryPositions, primary) : null,
            [.. row.OtherPositions.Select(position => ProfileColumnValues.Parse(ProfileColumnValues.Positions, position)).Order()]),
        row.SuggestedLevelTenths is { } tenths ? SkillLevel.FromTenths(tenths).Value : null,
        row.UpdatedAt);
}
