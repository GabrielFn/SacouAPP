using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Xunit;

namespace Sacou.Integration.Tests.Groups;

/// <summary>A guest row as stored, read straight from the table.</summary>
internal sealed record GuestState(Guid GroupId, string Name, string? PrimaryPosition);

/// <summary>The guest routes of E3.5 as a test calls them, and the rows they write.</summary>
internal static class GuestCalls
{
    public const string GuestNameInvalid = "groups.guest-name-invalid";
    public const string GuestInvalid = "groups.guest-invalid";
    public const string RoleNeedsAccount = "groups.role-needs-account";
    public const string MemberLimit = "groups.member-limit";

    public static string GuestsPath(GroupWorld world) => world.GroupPath + "/guests";

    public static string GuestPath(GroupWorld world, Guid memberId) => $"{GuestsPath(world)}/{memberId}";

    public static string AddBody(Guid requestId, string name, string? position = null, string? level = null)
    {
        var body = new JsonObject { ["requestId"] = requestId, ["name"] = name };
        if (position is not null)
        {
            body["primaryPosition"] = position;
        }

        var text = body.ToJsonString();
        return level is null ? text : text[..^1] + ",\"level\":" + level + "}";
    }

    public static string CorrectBody(string name, string? position) =>
        new JsonObject { ["name"] = name, ["primaryPosition"] = position }.ToJsonString();

    public static async Task<HttpResponseMessage> AddAsync(
        GroupWorld world, string name, Guid? requestId = null, GroupActor actor = GroupActor.Admin, string? position = null, string? level = null) =>
        await world.SendAsync(actor, HttpMethod.Post, GuestsPath(world), AddBody(requestId ?? Guid.NewGuid(), name, position, level));

    /// <summary>A new guest through the API, as the admin: its member id.</summary>
    public static async Task<Guid> CreateAsync(GroupWorld world, string name = "Léo", string? position = null, string? level = null)
    {
        using var response = await AddAsync(world, name, position: position, level: level);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await MemberIdAsync(response);
    }

    public static async Task<Guid> MemberIdAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return JsonNode.Parse(text)!["memberId"]!.GetValue<Guid>();
    }

    /// <summary>The members list as <paramref name="actor"/> reads it, by member id.</summary>
    public static async Task<Dictionary<Guid, JsonObject>> MembersAsync(GroupWorld world, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, world.GroupPath + "/members");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return JsonNode.Parse(text)!.AsArray().Select(item => item!.AsObject()).ToDictionary(item => item["memberId"]!.GetValue<Guid>());
    }

    public static async Task<GuestState?> ReadAsync(string connectionString, Guid memberId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var select = new NpgsqlCommand("SELECT group_id, name, primary_position FROM groups.guests WHERE member_id = @id", connection);
        select.Parameters.AddWithValue("id", memberId);
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        if (!await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            return null;
        }

        return new GuestState(reader.GetGuid(0), reader.GetString(1), await reader.IsDBNullAsync(2, TestContext.Current.CancellationToken) ? null : reader.GetString(2));
    }

    public static async Task<long> CountAsync(string connectionString, Guid groupId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var count = new NpgsqlCommand("SELECT count(*) FROM groups.guests WHERE group_id = @group", connection);
        count.Parameters.AddWithValue("group", groupId);
        return (long)(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
    }

    /// <summary>Every text column of every table of the Groups schema that holds <paramref name="text"/>, as <c>table.column</c>.</summary>
    public static async Task<IReadOnlyList<string>> FindTextAsync(string connectionString, string text)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        var columns = new List<(string Table, string Column)>();
        await using (var list = new NpgsqlCommand(
            "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'groups' AND data_type IN ('text', 'jsonb', 'character varying')",
            connection))
        await using (var reader = await list.ExecuteReaderAsync(TestContext.Current.CancellationToken))
        {
            while (await reader.ReadAsync(TestContext.Current.CancellationToken))
            {
                columns.Add((reader.GetString(0), reader.GetString(1)));
            }
        }

        var found = new List<string>();
        foreach (var (table, column) in columns)
        {
            // Names from the catalog, quoted; the searched text is a parameter.
            await using var search = new NpgsqlCommand($"SELECT count(*) FROM groups.\"{table}\" WHERE \"{column}\"::text LIKE @text", connection);
            search.Parameters.AddWithValue("text", "%" + text + "%");
            if ((long)(await search.ExecuteScalarAsync(TestContext.Current.CancellationToken))! > 0)
            {
                found.Add($"{table}.{column}");
            }
        }

        return found;
    }
}
