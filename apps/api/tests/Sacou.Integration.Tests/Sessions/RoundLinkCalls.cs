using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Xunit;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>The round link routes as a test calls them (E3.12, ADR 0070), and the rows they write.</summary>
internal static class RoundLinkCalls
{
    public const string ResolvePath = "/v1/round-links/resolve";
    public const string AttendancePath = "/v1/round-links/attendance";
    public const string LinkInvalid = "sessions.round-link-invalid";
    public const string RoundClosed = "sessions.round-closed";

    private const string PagePrefix = ApiWithDatabase.PublicBaseUrl + "/r/";

    /// <summary>The code at the end of the admin's share link.</summary>
    public static string CodeOf(JsonObject round)
    {
        var url = round["shareUrl"]!.GetValue<string>();
        Assert.StartsWith(PagePrefix, url, StringComparison.Ordinal);
        return url[PagePrefix.Length..];
    }

    /// <summary>A round made by the admin, and its link code.</summary>
    public static async Task<(string RoundId, string Code)> RoundAsync(GroupWorld world, string? body = null)
    {
        var round = await RoundCalls.CreateAsync(world, body);
        return (round["roundId"]!.GetValue<string>(), CodeOf(round));
    }

    public static string ResolveBody(string? code) => $$"""{"code":{{JsonValue.Create(code)?.ToJsonString() ?? "null"}}}""";

    public static string AnswerBody(string? code, bool going = true) =>
        $$"""{"code":{{JsonValue.Create(code)?.ToJsonString() ?? "null"}},"response":"{{(going ? "going" : "notGoing")}}"}""";

    public static async Task<(HttpStatusCode Status, JsonObject Body)> AnswerAsync(GroupWorld world, string subject, string code, bool going = true)
    {
        using var response = await world.SendAsAsync(subject, HttpMethod.Post, AttendancePath, AnswerBody(code, going));
        return (response.StatusCode, await RoundCalls.JsonAsync(response));
    }

    public static async Task<(HttpStatusCode Status, JsonObject Body)> AnswerAsync(GroupWorld world, GroupActor actor, string code, bool going = true) =>
        await AnswerAsync(world, world.Subjects[actor], code, going);

    /// <summary>The person's member row in the group, any status, or null: (id, role, type, status).</summary>
    public static async Task<(Guid Id, string Role, string Type, string Status)?> MemberOfAsync(string connectionString, Guid groupId, Guid userId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var select = new NpgsqlCommand(
            "SELECT id, role, member_type, status FROM groups.members WHERE group_id = @group AND user_id = @user", connection);
        select.Parameters.AddWithValue("group", groupId);
        select.Parameters.AddWithValue("user", userId);
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        return await reader.ReadAsync(TestContext.Current.CancellationToken)
            ? (reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3))
            : null;
    }

    /// <summary>The channel of a member's attendance row, or null without one.</summary>
    public static async Task<(string Status, int Sequence, string Channel)?> AttendanceOfAsync(string connectionString, string roundId, Guid memberId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var select = new NpgsqlCommand(
            "SELECT status, sequence, channel FROM sessions.attendances WHERE round_id = @round AND member_id = @member", connection);
        select.Parameters.AddWithValue("round", Guid.Parse(roundId));
        select.Parameters.AddWithValue("member", memberId);
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        return await reader.ReadAsync(TestContext.Current.CancellationToken)
            ? (reader.GetString(0), reader.GetInt32(1), reader.GetString(2))
            : null;
    }

    public static async Task ExecuteAsync(string connectionString, string sql, string roundId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("round", Guid.Parse(roundId));
        _ = await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    public static string? Code(JsonObject body) => body["code"]?.GetValue<string>();
}
