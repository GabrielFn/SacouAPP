using System.Reflection;
using Sacou.Modules.Matches.Domain.CourtSessions.Queue;
using Sacou.Modules.Matches.Domain.CourtSessions.Rotation;
using Sacou.Modules.Matches.Domain.CourtSessions.Score;
using Sacou.Modules.Matches.Domain.CourtSessions.Score.PayloadParsers;
using Xunit;

namespace Sacou.Modules.Matches.Tests.CourtSessions.Score;

/// <summary>
/// Security review A4, ADR 0033 D12: the properties and the constructor parameters of each payload
/// record are exactly the keys of its schema, at every level. A field added to a record without a
/// parser, or to a shape without a record, fails here.
/// </summary>
public sealed class PayloadRecordSchemaTests
{
    private const string EqualityContract = "EqualityContract";

    private static readonly IReadOnlyList<(Type Record, PayloadShape Shape)> RecordsAndShapes =
    [
        (typeof(MatchStartedPayload), ScorePayloadShapes.MatchStarted),
        (typeof(ScoringRules), Nested(ScorePayloadShapes.MatchStarted, PayloadFields.Scoring)),
        (typeof(BySide<TeamRoster>), Nested(ScorePayloadShapes.MatchStarted, PayloadFields.Teams)),
        (typeof(TeamRoster), Nested(Nested(ScorePayloadShapes.MatchStarted, PayloadFields.Teams), PayloadFields.SideA)),
        (typeof(BySide<TeamState?>), Nested(ScorePayloadShapes.MatchStarted, PayloadFields.Rotations)),
        (typeof(TeamState), ScorePayloadShapes.TeamState),
        (typeof(TeamLibero), ScorePayloadShapes.Libero),
        (typeof(TeamQueue), ScorePayloadShapes.QueueShape),
        (typeof(TeamRoster), ListItem(ScorePayloadShapes.QueueShape, PayloadFields.Teams)),
        (typeof(PointScoredPayload), ScorePayloadShapes.PointScored),
        (typeof(SetEndedPayload), ScorePayloadShapes.SetEnded),
        (typeof(NextSet), Nested(ScorePayloadShapes.SetEnded, PayloadFields.NextSet)),
        (typeof(BySide<int?>), Nested(Nested(ScorePayloadShapes.SetEnded, PayloadFields.NextSet), PayloadFields.SetterZones)),
        (typeof(MatchEndedPayload), ScorePayloadShapes.MatchEnded),
        (typeof(LineupChangedPayload), ScorePayloadShapes.LineupChanged),
        (typeof(QueueChangedPayload), ScorePayloadShapes.QueueChanged),
        (typeof(ServingTeamChangedPayload), ScorePayloadShapes.ServingTeamChanged),
        (typeof(PointAttributedPayload), ScorePayloadShapes.PointAttributed),
    ];

    public static TheoryData<int> Pairs => new(Enumerable.Range(0, RecordsAndShapes.Count));

    [Theory]
    [MemberData(nameof(Pairs))]
    public void RecordProperties_AreExactlyTheKeysOfTheShape(int pair)
    {
        var (record, shape) = RecordsAndShapes[pair];

        var properties = record.GetProperties(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
            .Where(property => property.Name != EqualityContract)
            .Select(property => CamelCase(property.Name));

        Assert.Equal(KeysOf(shape), properties.Order(StringComparer.Ordinal));
    }

    [Theory]
    [MemberData(nameof(Pairs))]
    public void ConstructorParameters_AreExactlyTheKeysOfTheShape(int pair)
    {
        var (record, shape) = RecordsAndShapes[pair];

        Assert.All(
            record.GetConstructors(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance)
                .Where(constructor => !IsCopyConstructor(constructor, record)),
            constructor => Assert.Equal(
                KeysOf(shape),
                constructor.GetParameters().Select(parameter => CamelCase(parameter.Name!)).Order(StringComparer.Ordinal)));
    }

    [Fact]
    public void EveryPayloadType_HasItsShapeHere()
    {
        var payloadTypes = typeof(ScorePayload).Assembly.GetTypes()
            .Where(type => type.IsSubclassOf(typeof(ScorePayload)) && !type.IsAbstract);

        Assert.All(payloadTypes, type => Assert.Contains(RecordsAndShapes, pair => pair.Record == type));
        Assert.Equal(ScoreEventTypes.All.Length, payloadTypes.Count());
    }

    private static List<string> KeysOf(PayloadShape shape) =>
        [.. shape.Fields.Select(field => field.Key).Order(StringComparer.Ordinal)];

    private static PayloadShape Nested(PayloadShape shape, string key) => shape.Fields.Single(field => field.Key == key).Nested!;

    private static PayloadShape ListItem(PayloadShape shape, string key) => shape.Fields.Single(field => field.Key == key).ListItem!;

    /// <summary>A record also has the constructor <c>with</c> uses, which takes the record itself.</summary>
    private static bool IsCopyConstructor(ConstructorInfo constructor, Type record) =>
        constructor.GetParameters() is [{ ParameterType: var parameterType }] && parameterType == record;

    private static string CamelCase(string name) => char.ToLowerInvariant(name[0]) + name[1..];
}
