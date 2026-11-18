using System.Net;
using System.Text.Json.Nodes;
using Npgsql;
using Sacou.Integration.Tests.Groups;
using Sacou.Integration.Tests.Sessions;
using Xunit;

namespace Sacou.Integration.Tests.Matches;

/// <summary>
/// One phone writing one court stream: its stream, installation and batch, and the next sequence. Each envelope is
/// built once as text, so a resend sends the very same bytes (ADR 0060, D2).
/// </summary>
internal sealed class CourtPhone(Guid courtSessionId, Guid deviceId, long batch = 1)
{
    private const int PointsPerSet = 25;
    private long nextSequence = 1;

    public Guid CourtSessionId { get; } = courtSessionId;

    public Guid DeviceId { get; } = deviceId;

    public Guid MatchId { get; private set; } = Guid.NewGuid();

    public static CourtPhone New() => new(Guid.NewGuid(), Guid.NewGuid());

    /// <summary>After a refused write, the phone goes on from the sequence the server expects.</summary>
    public void ResumeAt(long sequence) => nextSequence = sequence;

    /// <summary>The same stream from another installation (a second phone).</summary>
    public CourtPhone OtherDevice() => new(CourtSessionId, Guid.NewGuid());

    public string MatchStarted(Guid teamA, Guid teamB)
    {
        MatchId = Guid.NewGuid();
        return Envelope("MatchStarted", $$$"""
            {"firstServer":"a","formationsVersion":1,"matchId":"{{{MatchId}}}","queue":{"players":[],"teams":[]},"rotations":{"a":null,"b":null},"scoring":{"bestOf":3,"pointsPerSet":{{{PointsPerSet}}},"tieBreakPoints":15,"winMargin":2},"teams":{"a":{"memberIds":["{{{teamA}}}"]},"b":{"memberIds":["{{{teamB}}}"]}},"rulesVersion":1}
            """);
    }

    public string Point(string team) => Envelope("PointScored", $$"""{"matchId":"{{MatchId}}","setNumber":1,"team":"{{team}}"}""");

    /// <summary>Points that never decide the set: a, b, a, b... the margin stays at one at most.</summary>
    public IEnumerable<string> AlternatingPoints(int count) => Enumerable.Range(0, count).Select(index => Point(index % 2 == 0 ? "a" : "b"));

    public string ManualEnd() => Envelope("MatchEnded", $$"""{"endReason":"manual","matchId":"{{MatchId}}","winner":null}""");

    public string Envelope(string type, string payload) => Envelope(Guid.NewGuid(), type, payload.Trim());

    public string Envelope(Guid eventId, string type, string payload) =>
        $$$"""{"eventId":"{{{eventId}}}","courtSessionId":"{{{CourtSessionId}}}","deviceId":"{{{DeviceId}}}","batch":{{{batch}}},"sequence":{{{nextSequence++}}},"payload":{{{payload}}},"schemaVersion":1,"type":"{{{type}}}"}""";

    public static string Body(IEnumerable<string> envelopes) => $$"""{"events":[{{string.Join(',', envelopes)}}]}""";
}

internal static class CourtCalls
{
    public const string RoundNotFound = "sessions.round-not-found";

    public static string EventsPath(GroupWorld world, string roundId, Guid courtSessionId) =>
        $"{RoundCalls.RoundPath(world, roundId)}/court-sessions/{courtSessionId}/events";

    public static async Task<string> RoundAsync(GroupWorld world) => (await RoundCalls.CreateAsync(world))["roundId"]!.GetValue<string>();

    public static Task<HttpResponseMessage> SendAsync(GroupWorld world, GroupActor actor, string roundId, CourtPhone phone, IEnumerable<string> envelopes) =>
        world.SendAsync(actor, HttpMethod.Post, EventsPath(world, roundId, phone.CourtSessionId), CourtPhone.Body(envelopes));

    /// <summary>A write that must be accepted: its <c>lastSequence</c> and <c>stored</c>.</summary>
    public static async Task<(long LastSequence, int Stored)> AcceptedAsync(
        GroupWorld world, GroupActor actor, string roundId, CourtPhone phone, IEnumerable<string> envelopes)
    {
        using var response = await SendAsync(world, actor, roundId, phone, envelopes);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.OK, body);
        var json = JsonNode.Parse(body)!.AsObject();
        Assert.Equal(["lastSequence", "stored"], json.Select(member => member.Key).Order(StringComparer.Ordinal));
        return (json["lastSequence"]!.GetValue<long>(), json["stored"]!.GetValue<int>());
    }

    public static async Task<IReadOnlyList<string>> StoredEnvelopesAsync(string connectionString, Guid courtSessionId)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var select = new NpgsqlCommand(
            "SELECT envelope FROM matches.court_events WHERE court_session_id = @id ORDER BY position", connection);
        select.Parameters.AddWithValue("id", courtSessionId);
        var envelopes = new List<string>();
        await using var reader = await select.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        while (await reader.ReadAsync(TestContext.Current.CancellationToken))
        {
            envelopes.Add(reader.GetString(0));
        }

        return envelopes;
    }

    public static async Task<long> CountAsync(string connectionString, string sql, Guid id)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var count = new NpgsqlCommand(sql, connection);
        count.Parameters.AddWithValue("id", id);
        return Convert.ToInt64(await count.ExecuteScalarAsync(TestContext.Current.CancellationToken), System.Globalization.CultureInfo.InvariantCulture);
    }

    public static Task<long> EventCountAsync(string connectionString, Guid courtSessionId) =>
        CountAsync(connectionString, "SELECT count(*) FROM matches.court_events WHERE court_session_id = @id", courtSessionId);

    public static async Task ExecuteAsync(string connectionString, string sql, params (string Name, object Value)[] parameters)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value);
        }

        _ = await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>The problem body without its <c>traceId</c>, which differs per request by design.</summary>
    public static async Task<string> ProblemWithoutTraceAsync(HttpResponseMessage response)
    {
        var body = JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!.AsObject();
        _ = body.Remove("traceId");
        return body.ToJsonString();
    }
}
