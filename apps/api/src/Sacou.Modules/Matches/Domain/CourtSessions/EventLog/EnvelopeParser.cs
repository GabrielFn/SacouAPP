namespace Sacou.Modules.Matches.Domain.CourtSessions.EventLog;

/// <summary>
/// Port of <c>parse-envelope.ts</c>: validates untrusted input and fails closed. Errors name a schema
/// field and never echo the input. The checks run in the TypeScript order: the root, then unknown
/// fields, then each field in schema order. A repeated key is refused (ADR 0033, D3).
/// </summary>
internal static class EnvelopeParser
{
    private const int MinPositiveInteger = 1;
    private const int MinEventTypeLength = 1;

    public static Result<EventEnvelope, EnvelopeError> Parse(RawValue raw)
    {
        if (raw is not RawObject envelope || HasRepeatedKey(envelope))
        {
            return Invalid(EventLogSchema.EnvelopeRootField);
        }

        return HasOnlyKnownFields(envelope)
            ? ParseFields(envelope)
            : Invalid(EventLogSchema.UnknownEnvelopeField);
    }

    private static Result<EventEnvelope, EnvelopeError> ParseFields(RawObject envelope)
    {
        if (ReadUuid(envelope, EnvelopeFields.EventId) is not { } eventId)
        {
            return Invalid(EnvelopeFields.EventId);
        }

        if (ReadUuid(envelope, EnvelopeFields.CourtSessionId) is not { } courtSessionId)
        {
            return Invalid(EnvelopeFields.CourtSessionId);
        }

        if (ReadUuid(envelope, EnvelopeFields.DeviceId) is not { } deviceId)
        {
            return Invalid(EnvelopeFields.DeviceId);
        }

        if (ReadPositiveSafeInteger(envelope, EnvelopeFields.Batch) is not { } batch)
        {
            return Invalid(EnvelopeFields.Batch);
        }

        if (ReadPositiveSafeInteger(envelope, EnvelopeFields.Sequence) is not { } sequence)
        {
            return Invalid(EnvelopeFields.Sequence);
        }

        if (ReadPositiveSafeInteger(envelope, EnvelopeFields.SchemaVersion) is not { } schemaVersion)
        {
            return Invalid(EnvelopeFields.SchemaVersion);
        }

        if (ReadEventType(envelope) is not { } type)
        {
            return Invalid(EnvelopeFields.Type);
        }

        if (ReadPayload(envelope) is not { } payload)
        {
            return Invalid(EnvelopeFields.Payload);
        }

        return Result<EventEnvelope, EnvelopeError>.Success(
            new EventEnvelope(eventId, courtSessionId, deviceId, batch, sequence, schemaVersion, type, payload));
    }

    private static Result<EventEnvelope, EnvelopeError> Invalid(string field) =>
        Result<EventEnvelope, EnvelopeError>.Failure(new EnvelopeError(field));

    private static bool HasOnlyKnownFields(RawObject envelope) =>
        envelope.Members.All(member => EnvelopeFields.All.Contains(member.Key, StringComparer.Ordinal));

    private static bool HasRepeatedKey(RawObject envelope) =>
        envelope.Members.DistinctBy(member => member.Key, StringComparer.Ordinal).Count() != envelope.Members.Length;

    private static string? ReadUuid(RawObject envelope, string field) =>
        envelope.TryGetMember(field, out var value) && value is RawString text && LowercaseUuid.IsValid(text.Value)
            ? text.Value
            : null;

    /// <summary>
    /// Always through the double, as in JavaScript: <c>25.0</c> and <c>2.5e1</c> are 25, and
    /// <c>9007199254740992</c> is refused, because a double no longer tells it from its neighbour.
    /// </summary>
    private static long? ReadPositiveSafeInteger(RawObject envelope, string field)
    {
        if (!envelope.TryGetMember(field, out var value) || value is not RawNumber number)
        {
            return null;
        }

        var isPositiveSafeInteger = double.IsFinite(number.Value)
            && Math.Floor(number.Value) == number.Value
            && number.Value >= MinPositiveInteger
            && number.Value <= EventLogSchema.MaxSafeInteger;
        return isPositiveSafeInteger ? (long)number.Value : null;
    }

    private static string? ReadEventType(RawObject envelope) =>
        envelope.TryGetMember(EnvelopeFields.Type, out var value)
            && value is RawString text
            && text.Value.Length is >= MinEventTypeLength and <= EventLogSchema.MaxEventTypeLength
                ? text.Value
                : null;

    private static RawObject? ReadPayload(RawObject envelope) =>
        envelope.TryGetMember(EnvelopeFields.Payload, out var value) ? PayloadCopier.Copy(value) : null;
}
