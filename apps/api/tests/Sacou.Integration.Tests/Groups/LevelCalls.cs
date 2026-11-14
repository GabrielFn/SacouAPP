using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>A level row as stored: the tenths (null for "Não sei") and who set it.</summary>
internal sealed record LevelState(short? Tenths, Guid SetBy);

/// <summary>The admin's level routes as a test calls them, and the rows they write, read straight from the table.</summary>
internal static class LevelCalls
{
    public const string LevelInvalid = "groups.level-invalid";
    public const string MemberNotFound = "groups.member-not-found";

    public static string ListPath(GroupWorld world) => world.GroupPath + "/member-levels";

    public static string MemberPath(GroupWorld world, Guid memberId) => $"{world.GroupPath}/member-levels/{memberId}";

    public static string One(string level) => $$"""{"level":{{level}}}""";

    public static string Batch(params (Guid MemberId, string Level)[] items) =>
        $$"""{"levels":[{{string.Join(',', items.Select(item => $$"""{"memberId":"{{item.MemberId}}","level":{{item.Level}}}"""))}}]}""";

    public static async Task<HttpResponseMessage> SetAsync(GroupWorld world, GroupActor actor, Guid memberId, string level) =>
        await world.SendAsync(actor, HttpMethod.Put, MemberPath(world, memberId), One(level));

    /// <summary>The list as the admin reads it, by member id.</summary>
    public static async Task<Dictionary<Guid, JsonObject>> ListAsync(GroupWorld world, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, ListPath(world));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsArray()
            .Select(item => item!.AsObject())
            .ToDictionary(item => item["memberId"]!.GetValue<Guid>());
    }

    public static async Task<LevelState?> ReadAsync(string connectionString, Guid memberId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var select = new NpgsqlCommand("SELECT level_tenths, set_by_member_id FROM groups.member_levels WHERE member_id = @id", connection);
        select.Parameters.AddWithValue("id", memberId);
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        if (!await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            return null;
        }

        return new LevelState(await reader.IsDBNullAsync(0, TestContext.Current.CancellationToken) ? null : reader.GetInt16(0), reader.GetGuid(1));
    }

    public static async Task<long> CountAsync(string connectionString, Guid groupId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var count = new NpgsqlCommand("SELECT count(*) FROM groups.member_levels WHERE group_id = @group", connection);
        count.Parameters.AddWithValue("group", groupId);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }
}
