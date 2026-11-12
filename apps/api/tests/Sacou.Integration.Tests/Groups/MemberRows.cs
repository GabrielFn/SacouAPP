using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>What a member row holds, read straight from the table, to prove what a write did or did not do.</summary>
internal sealed record MemberState(string Role, string MemberType, string Status, bool HasLeftAt);

internal static class MemberRows
{
    public static async Task<MemberState> ReadAsync(string connectionString, Guid memberId)
    {
        await using var connection = await OpenAsync(connectionString);
        await using var select = new NpgsqlCommand(
            "SELECT role, member_type, status, left_at IS NOT NULL FROM groups.members WHERE id = @id", connection);
        select.Parameters.AddWithValue("id", memberId);
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        Assert.True(await reader.ReadAsync(TestContext.Current.CancellationToken));
        return new MemberState(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetBoolean(3));
    }

    public static async Task<long> CountActiveAdminsAsync(string connectionString, Guid groupId)
    {
        await using var connection = await OpenAsync(connectionString);
        await using var count = new NpgsqlCommand(
            "SELECT count(*) FROM groups.members WHERE group_id = @group AND status = 'active' AND role = 'admin'", connection);
        count.Parameters.AddWithValue("group", groupId);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    public static async Task SetRoleAsync(string connectionString, Guid memberId, string role)
    {
        await using var connection = await OpenAsync(connectionString);
        await using var update = new NpgsqlCommand("UPDATE groups.members SET role = @role WHERE id = @id", connection);
        update.Parameters.AddWithValue("id", memberId);
        update.Parameters.AddWithValue("role", role);
        await update.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    public static async Task RemoveAsync(string connectionString, Guid memberId)
    {
        await using var connection = await OpenAsync(connectionString);
        await using var update = new NpgsqlCommand("UPDATE groups.members SET status = 'removed', left_at = now() WHERE id = @id", connection);
        update.Parameters.AddWithValue("id", memberId);
        await update.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    public static async Task<NpgsqlConnection> OpenAsync(string connectionString)
    {
        var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }
}
