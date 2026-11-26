using System.Text.Json.Nodes;
using Npgsql;
using Xunit;
using A = Sacou.Integration.Tests.Groups.GroupActor;

namespace Sacou.Integration.Tests.Groups;

/// <summary>A row of <c>groups.content_reports</c>, read straight from the table (E6.6).</summary>
internal sealed record ReportRow(Guid GroupId, Guid Reporter, Guid? Reported, string Reason, DateTimeOffset CreatedAt);

/// <summary>The calls and reads of the report route (E6.6).</summary>
internal static class ReportCalls
{
    public static string Path(GroupWorld world) => world.GroupPath + "/reports";

    public static string Body(Guid? reported, string reason) =>
        $$"""{"reportedMemberId":{{(reported is { } id ? $"\"{id}\"" : "null")}},"reason":"{{reason}}"}""";

    public static Task<HttpResponseMessage> ReportAsync(GroupWorld world, A actor, Guid? reported, string reason = "offensiveName") =>
        world.SendAsync(actor, HttpMethod.Post, Path(world), Body(reported, reason));

    public static Task<HttpResponseMessage> ReportAsAsync(GroupWorld world, string subject, Guid? reported, string reason = "offensiveName") =>
        world.SendAsAsync(subject, HttpMethod.Post, Path(world), Body(reported, reason));

    public static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return text.Length == 0 ? null : JsonNode.Parse(text)?["code"]?.GetValue<string>();
    }

    /// <summary>Every report row of the group, oldest first.</summary>
    public static async Task<IReadOnlyList<ReportRow>> RowsAsync(string connectionString, Guid groupId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var select = new NpgsqlCommand(
            "SELECT group_id, reporter_member_id, reported_member_id, reason, created_at FROM groups.content_reports WHERE group_id = @group ORDER BY id", connection);
        select.Parameters.AddWithValue("group", groupId);
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        var rows = new List<ReportRow>();
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            rows.Add(new ReportRow(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.IsDBNull(2) ? null : reader.GetGuid(2),
                reader.GetString(3),
                reader.GetFieldValue<DateTimeOffset>(4)));
        }

        return rows;
    }

    /// <summary>Moves every report of the group back in time, for the sweep.</summary>
    public static async Task AgeAsync(string connectionString, Guid groupId, Guid reported, TimeSpan age)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var update = new NpgsqlCommand(
            "UPDATE groups.content_reports SET created_at = now() - @age WHERE group_id = @group AND reported_member_id = @reported", connection);
        update.Parameters.AddWithValue("age", age);
        update.Parameters.AddWithValue("group", groupId);
        update.Parameters.AddWithValue("reported", reported);
        await update.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }
}
