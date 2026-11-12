using Npgsql;
using Sacou.Integration.Tests.Groups;
using Xunit;

namespace Sacou.Integration.Tests.Identity;

/// <summary>
/// What a profile row holds, read straight from the table, to prove what a write did or did not do. The other
/// positions are joined with commas, in the stored order, so two states compare by value.
/// </summary>
internal sealed record ProfileState(string Nickname, string? PrimaryPosition, string OtherPositions, short? SuggestedLevelTenths);

internal static class ProfileRows
{
    public const string ProfilePath = "/v1/me/profile";

    /// <summary>A valid body: the four keys, with the values given.</summary>
    public static string Body(string nickname = "Caio", string primary = "\"setter\"", string others = "[\"libero\"]", string level = "4.5") =>
        $$"""{"nickname":{{System.Text.Json.Nodes.JsonValue.Create(nickname).ToJsonString()}},"primaryPosition":{{primary}},"otherPositions":{{others}},"suggestedLevel":{{level}}}""";

    public static async Task<ProfileState?> ReadAsync(string connectionString, Guid user)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var select = new NpgsqlCommand(
            "SELECT nickname, primary_position, other_positions, suggested_level_tenths FROM identity.player_profiles WHERE user_id = @user", connection);
        select.Parameters.AddWithValue("user", user);
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        if (!await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            return null;
        }

        return new ProfileState(
            reader.GetString(0),
            await reader.IsDBNullAsync(1, TestContext.Current.CancellationToken) ? null : reader.GetString(1),
            string.Join(',', reader.GetFieldValue<string[]>(2)),
            await reader.IsDBNullAsync(3, TestContext.Current.CancellationToken) ? null : reader.GetInt16(3));
    }

    public static async Task<long> CountAsync(string connectionString, Guid user)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var count = new NpgsqlCommand("SELECT count(*) FROM identity.player_profiles WHERE user_id = @user", connection);
        count.Parameters.AddWithValue("user", user);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }
}
