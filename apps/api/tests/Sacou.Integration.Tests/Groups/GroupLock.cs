using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>Holds a group row the way the API's writes do, and waits until a request is queued behind it.</summary>
internal static class GroupLock
{
    private static readonly TimeSpan WaitTimeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(20);

    /// <summary>Inside the caller's open transaction on <paramref name="connection"/>.</summary>
    public static async Task HoldAsync(NpgsqlConnection connection, Guid groupId)
    {
        await using var select = new NpgsqlCommand("SELECT id FROM groups.groups WHERE id = @group FOR UPDATE", connection);
        select.Parameters.AddWithValue("group", groupId);
        await select.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>Until some session is blocked by <paramref name="holderProcessId"/>; times out, and fails the test, if none ever is.</summary>
    public static async Task WaitUntilBlockedAsync(string connectionString, int holderProcessId)
    {
        using var deadline = new CancellationTokenSource(WaitTimeout);
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var blocked = new NpgsqlCommand(
            "SELECT count(*) FROM pg_stat_activity WHERE @holder = ANY(pg_blocking_pids(pid))", connection);
        blocked.Parameters.AddWithValue("holder", holderProcessId);
        while ((long)(await blocked.ExecuteScalarAsync(deadline.Token))! == 0)
        {
            await Task.Delay(PollInterval, deadline.Token);
        }
    }
}
