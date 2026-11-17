using System.Collections.Immutable;
using System.Globalization;
using System.Text;
using Sacou.Modules.Matches.CourtSessionJson;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Writes;

/// <summary>Builds envelopes of the score catalog as JSON text and runs them through the write rules.</summary>
internal static class CourtWriteFixture
{
    public const string Court = "c0000000-0000-4000-8000-000000000001";
    public const string Device = "d0000000-0000-4000-8000-000000000001";
    public const string OtherDevice = "d0000000-0000-4000-8000-000000000002";
    public const string Match = "f0000000-0000-4000-8000-000000000001";
    public const string Caller = "a0000000-0000-4000-8000-0000000000aa";
    public const string OtherCaller = "a0000000-0000-4000-8000-0000000000bb";
    public const string MemberA = "a0000000-0000-4000-8000-000000000001";
    public const string MemberB = "b0000000-0000-4000-8000-000000000001";
    public const string Outsider = "90000000-0000-4000-8000-000000000001";

    public static readonly ImmutableHashSet<string> Group =
        ImmutableHashSet.Create(StringComparer.Ordinal, MemberA, MemberB, Caller, OtherCaller);

    public static readonly CourtWriteContext Context = new(
        Caller, Group, SupportedVersions.RulesVersions, SupportedVersions.FormationsVersions);

    public static string EventId(long number) =>
        $"e0000000-0000-4000-8000-{number.ToString("D12", CultureInfo.InvariantCulture)}";

    public static string Envelope(long sequence, string type, string payload, string? device = null, long batch = 1, string? eventId = null) =>
        $$"""{"eventId":"{{eventId ?? EventId(sequence)}}","courtSessionId":"{{Court}}","deviceId":"{{device ?? Device}}","batch":{{batch}},"sequence":{{sequence}},"schemaVersion":1,"type":"{{type}}","payload":{{payload}}}""";

    public static string MatchStarted(int bestOf = 3, int points = 3, string tieBreak = "null", string teamB = MemberB, long rulesVersion = 1) =>
        $$$"""{"matchId":"{{{Match}}}","rulesVersion":{{{rulesVersion}}},"formationsVersion":1,"scoring":{"bestOf":{{{bestOf}}},"pointsPerSet":{{{points}}},"tieBreakPoints":{{{tieBreak}}},"winMargin":2},"teams":{"a":{"memberIds":["{{{MemberA}}}"]},"b":{"memberIds":["{{{teamB}}}"]}},"firstServer":"a","rotations":{"a":null,"b":null},"queue":{"players":[],"teams":[]}}""";

    public static string Point(string team, int set = 1) => $$"""{"matchId":"{{Match}}","setNumber":{{set}},"team":"{{team}}"}""";

    public static string SetEnded(int set, string winner, string nextSet) =>
        $$"""{"matchId":"{{Match}}","setNumber":{{set}},"winner":"{{winner}}","nextSet":{{nextSet}}}""";

    public static string NextSet(string firstServer, int targetPoints) =>
        $$"""{"firstServer":"{{firstServer}}","setterZones":{"a":null,"b":null},"targetPoints":{{targetPoints}}}""";

    public static string MatchEnded(string reason, string winner) =>
        $$"""{"matchId":"{{Match}}","endReason":"{{reason}}","winner":{{winner}}}""";

    public static string ServingChanged(string servingTeam, string firstServer) =>
        $$"""{"matchId":"{{Match}}","setNumber":1,"servingTeam":"{{servingTeam}}","firstServer":"{{firstServer}}"}""";

    public static string Attributed(long pointSequence, string kind, string author) =>
        $$"""{"matchId":"{{Match}}","pointEventId":"{{EventId(pointSequence)}}","kind":"{{kind}}","author":{{author}}}""";

    public static string QueueOf(string players) => $$$"""{"matchId":"{{{Match}}}","queue":{"players":[{{{players}}}],"teams":[]}}""";

    public static string Revert(long targetSequence) => $$"""{"targetEventId":"{{EventId(targetSequence)}}"}""";

    public static string Quoted(string text) => $"\"{text}\"";

    public static StreamEvent Parse(string json)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        var envelope = EnvelopeParser.Parse(RawValueReader.Parse(bytes));
        Assert.True(envelope.IsSuccess, envelope.ToString());
        return new StreamEvent(envelope.Value, bytes.Length);
    }

    /// <summary>Envelopes numbered from <paramref name="firstSequence"/>, one after the other.</summary>
    public static ImmutableArray<StreamEvent> Events(long firstSequence, params (string Type, string Payload)[] events) =>
        [.. events.Select((item, index) => Parse(Envelope(firstSequence + index, item.Type, item.Payload)))];

    public static StoredStream Stored(ImmutableArray<StreamEvent> events, CourtWriter? writer = null) =>
        StoredStream.Of(events, writer ?? new CourtWriter(1, Device, Caller));

    public static Result<CourtWriteDecision, CourtWriteError> Decide(
        StoredStream stored,
        ImmutableArray<StreamEvent> events,
        CourtWriteContext? context = null)
    {
        var request = CourtWriteRequest.Create(Court, events, SupportedVersions.EventSchemaVersions);
        Assert.True(request.IsSuccess, request.ToString());
        return CourtWriteRules.Decide(stored, request.Value, context ?? Context);
    }

    public static CourtWriteError Refused(Result<CourtWriteDecision, CourtWriteError> result)
    {
        Assert.True(result.IsFailure, "Expected a refusal.");
        return result.Error;
    }

    public static CourtWriteDecision Accepted(Result<CourtWriteDecision, CourtWriteError> result)
    {
        Assert.True(result.IsSuccess, result.IsSuccess ? null : $"{result.Error.Code} {result.Error.Reason}{result.Error.Limit} at {result.Error.EventId}");
        return result.Value;
    }
}
