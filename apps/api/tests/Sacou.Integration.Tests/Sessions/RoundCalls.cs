using System.Globalization;
using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Xunit;

namespace Sacou.Integration.Tests.Sessions;

/// <summary>The round routes as a test calls them, and the attendance table as it really is.</summary>
internal static class RoundCalls
{
    public const string NotRegistered = "identity.user-not-registered";
    public const string GroupNotFound = "groups.group-not-found";
    public const string Forbidden = "groups.forbidden";

    public static string RoundsPath(GroupWorld world) => world.GroupPath + "/rounds";

    public static string RoundPath(GroupWorld world, string roundId) => $"{RoundsPath(world)}/{roundId}";

    /// <summary>A local date a few days ahead, always in the future whatever the time of the run.</summary>
    public static string FutureDate(int days = 3) =>
        DateTime.UtcNow.AddDays(days).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static string CreateBody(string? date = null, bool repeat = false, string? settings = null) =>
        $$"""{"localDate":"{{date ?? FutureDate()}}","localTime":"20:30","venue":"Quadra 3","repeatWeekly":{{(repeat ? "true" : "false")}}{{(settings is null ? "" : ",\"settings\":" + settings)}}}""";

    public static async Task<JsonObject> JsonAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return JsonNode.Parse(text)!.AsObject();
    }

    public static async Task<JsonArray> JsonAsyncArray(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return JsonNode.Parse(text)!.AsArray();
    }

    public static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        return response.IsSuccessStatusCode || text.Length == 0 ? null : JsonNode.Parse(text)?.AsObject()["code"]?.GetValue<string>();
    }

    /// <summary>Attendance on, with a limit and (optionally) the waitlist, written through the Groups settings route as the admin.</summary>
    public static async Task ConfigureAttendanceAsync(GroupWorld world, int capacity = 12, bool waitlist = true, bool regulars = false)
    {
        var attendance = string.Create(CultureInfo.InvariantCulture,
            $"\"enabled\":true,\"capacityLimited\":true,\"capacity\":{capacity},\"waitlistEnabled\":{Flag(waitlist)},\"regularsEnabled\":{Flag(regulars)}");
        var patch = "{\"settings\":{\"schemaVersion\":1,\"attendance\":{" + attendance + "}}}";
        using var response = await world.SendAsync(GroupActor.Admin, HttpMethod.Patch, world.GroupPath + "/settings", patch);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    public static async Task<JsonObject> CreateAsync(GroupWorld world, string? body = null, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Post, RoundsPath(world), body ?? CreateBody());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await JsonAsync(response);
    }

    public static async Task<JsonObject> GetAsync(GroupWorld world, string roundId, GroupActor actor = GroupActor.Admin)
    {
        using var response = await world.SendAsync(actor, HttpMethod.Get, RoundPath(world, roundId));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    private static string Flag(bool on) => on ? "true" : "false";

    public static string Response(bool going) => going ? """{"response":"going"}""" : """{"response":"notGoing"}""";

    /// <summary>The player's own answer (route 6), as the person with that subject.</summary>
    public static async Task<(HttpStatusCode Status, string? Code, JsonObject? Body)> RespondAsync(
        GroupWorld world, string subject, string roundId, bool going)
    {
        using var response = await world.SendAsAsync(subject, HttpMethod.Put, RoundPath(world, roundId) + "/attendance/me", Response(going));
        var code = await CodeAsync(response);
        return (response.StatusCode, code, response.IsSuccessStatusCode ? await JsonAsync(response) : null);
    }

    /// <summary>The admin's answer for a member (route 7).</summary>
    public static async Task<HttpStatusCode> SetAsync(GroupWorld world, string roundId, Guid memberId, bool going)
    {
        using var response = await world.SendAsync(
            GroupActor.Admin, HttpMethod.Put, $"{RoundPath(world, roundId)}/attendance/{memberId}", Response(going));
        return response.StatusCode;
    }

    public sealed record AttendanceRow(Guid MemberId, string Status, int Sequence);

    public static async Task<IReadOnlyList<AttendanceRow>> RowsAsync(string connectionString, string roundId)
    {
        await using var connection = await MemberRows.OpenAsync(connectionString);
        await using var select = new NpgsqlCommand(
            "SELECT member_id, status, sequence FROM sessions.attendances WHERE round_id = @round ORDER BY sequence", connection);
        select.Parameters.AddWithValue("round", Guid.Parse(roundId));
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        var rows = new List<AttendanceRow>();
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            rows.Add(new AttendanceRow(reader.GetGuid(0), reader.GetString(1), reader.GetInt32(2)));
        }

        return rows;
    }
}
