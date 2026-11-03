using System.Collections.Immutable;

namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>Port of <c>event-log/constants.data.ts</c>.</summary>
internal static class EventLogSchema
{
    public const long CurrentEventSchemaVersion = 1;

    public const string RevertedToEventType = "RevertedTo";

    /// <summary>The only member of a <c>RevertedTo</c> payload.</summary>
    public const string RevertTargetField = "targetEventId";

    /// <summary>Reported when the input as a whole is not an envelope object.</summary>
    public const string EnvelopeRootField = "envelope";

    /// <summary>Reported instead of the name of an unknown field, which is received data and may be personal.</summary>
    public const string UnknownEnvelopeField = "unknown-field";

    /// <summary>In UTF-16 code units, like <c>length</c> in JavaScript: a surrogate pair counts two.</summary>
    public const int MaxEventTypeLength = 64;

    /// <summary>Levels of nested objects and arrays in a payload, counting the payload itself.</summary>
    public const int MaxPayloadDepth = 32;

    /// <summary>JSON values in a payload, counting the payload itself.</summary>
    public const int MaxPayloadNodes = 4096;

    /// <summary><c>Number.MAX_SAFE_INTEGER</c>: the largest integer a double holds with no gap.</summary>
    public const double MaxSafeInteger = 9_007_199_254_740_991;

    public static readonly ImmutableArray<long> SupportedEventSchemaVersions = [CurrentEventSchemaVersion];
}

/// <summary>The closed schema of the envelope, in the order the parser checks it: anything else is rejected.</summary>
internal static class EnvelopeFields
{
    public const string EventId = "eventId";
    public const string CourtSessionId = "courtSessionId";
    public const string DeviceId = "deviceId";
    public const string Batch = "batch";
    public const string Sequence = "sequence";
    public const string SchemaVersion = "schemaVersion";
    public const string Type = "type";
    public const string Payload = "payload";

    public static readonly ImmutableArray<string> All =
        [EventId, CourtSessionId, DeviceId, Batch, Sequence, SchemaVersion, Type, Payload];
}
