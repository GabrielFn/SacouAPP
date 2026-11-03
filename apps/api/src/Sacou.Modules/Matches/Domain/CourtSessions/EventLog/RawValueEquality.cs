namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// Port of <c>jsonEquals</c> and <c>haveSameContent</c> in <c>normalize-log.ts</c>. Numbers compare
/// with <c>==</c>, like <c>===</c>, so <c>-0</c> equals <c>0</c>. Objects compare member by member,
/// which ignores key order only because the parser sorted them and refused repeated keys. Recursive:
/// safe only on parser output, whose depth is limited.
/// </summary>
internal static class RawValueEquality
{
    public static bool HaveSameContent(EventEnvelope left, EventEnvelope right) =>
        string.Equals(left.EventId, right.EventId, StringComparison.Ordinal)
        && string.Equals(left.CourtSessionId, right.CourtSessionId, StringComparison.Ordinal)
        && string.Equals(left.DeviceId, right.DeviceId, StringComparison.Ordinal)
        && left.Batch == right.Batch
        && left.Sequence == right.Sequence
        && left.SchemaVersion == right.SchemaVersion
        && string.Equals(left.Type, right.Type, StringComparison.Ordinal)
        && AreEqual(left.Payload, right.Payload);

    public static bool AreEqual(RawValue left, RawValue right) => (left, right) switch
    {
        (RawNull, RawNull) => true,
        (RawBoolean first, RawBoolean second) => first.Value == second.Value,
        (RawNumber first, RawNumber second) => first.Value == second.Value,
        (RawString first, RawString second) => string.Equals(first.Value, second.Value, StringComparison.Ordinal),
        (RawArray first, RawArray second) => ArraysEqual(first, second),
        (RawObject first, RawObject second) => ObjectsEqual(first, second),
        _ => false,
    };

    private static bool ArraysEqual(RawArray left, RawArray right) =>
        left.Items.Length == right.Items.Length
        && left.Items.Zip(right.Items).All(pair => AreEqual(pair.First, pair.Second));

    private static bool ObjectsEqual(RawObject left, RawObject right) =>
        left.Members.Length == right.Members.Length
        && left.Members.Zip(right.Members).All(pair =>
            string.Equals(pair.First.Key, pair.Second.Key, StringComparison.Ordinal)
            && AreEqual(pair.First.Value, pair.Second.Value));
}
