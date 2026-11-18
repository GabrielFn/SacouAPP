using System.Collections.Immutable;
using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.EventLog;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.CourtSessionJson;

/// <summary>
/// Why a request body was refused before the domain saw it. Carries a field of the closed list or the
/// index of an element, never a received byte, key or position (ADR 0060, D8 and D15).
/// </summary>
internal sealed record EventBatchError(string Code, string? Field = null, int? Index = null)
{
    public const string BatchInvalidCode = "batch-invalid";
    public const string EventTooLargeCode = "event-too-large";
    public const string InvalidEnvelopeCode = EnvelopeError.InvalidEnvelopeCode;

    /// <summary>The body as a whole: malformed JSON, not an object, or content after it.</summary>
    public const string BodyField = "body";

    public const string EventsField = "events";

    public override string ToString() => $"{nameof(EventBatchError)}({Code})";
}

/// <summary>An element of the body: its own bytes, kept to be stored as received, and the parsed event.</summary>
internal sealed record ReceivedEvent(ReadOnlyMemory<byte> Utf8Json, StreamEvent Event)
{
    public override string ToString() => nameof(ReceivedEvent);
}

/// <summary>
/// Reads the body <c>{ "events": [ ... ] }</c> with no tree (ADR 0060, D8 step 2): a <see cref="Utf8JsonReader"/>
/// walks the bytes, each element is measured by its byte range and refused above
/// <see cref="CourtStreamLimits.MaxEnvelopeBytes"/> before <see cref="RawValueReader"/> allocates
/// anything for it, and only then each element goes through the raw reader and the envelope parser.
/// </summary>
internal static class EventBatchReader
{
    private static readonly JsonReaderOptions ReaderOptions = new()
    {
        AllowTrailingCommas = false,
        CommentHandling = JsonCommentHandling.Disallow,
        MaxDepth = RawValueReader.MaxDepth,
    };

    /// <summary>The structure only: the byte range of each element, in order.</summary>
    public static Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError> ReadElements(ReadOnlyMemory<byte> body)
    {
        try
        {
            return ReadRoot(body);
        }
        catch (JsonException)
        {
            // Not forwarded: the message names the offending byte and its position.
            return Invalid(EventBatchError.BodyField);
        }
    }

    /// <summary>The structure, then each element through the raw reader and the envelope parser, the first error deciding.</summary>
    public static Result<ImmutableArray<ReceivedEvent>, EventBatchError> ReadEnvelopes(ReadOnlyMemory<byte> body)
    {
        var elements = ReadElements(body);
        if (elements.IsFailure)
        {
            return elements.Forward<ImmutableArray<ReceivedEvent>>();
        }

        var received = ImmutableArray.CreateBuilder<ReceivedEvent>(elements.Value.Length);
        for (var index = 0; index < elements.Value.Length; index++)
        {
            var element = elements.Value[index];
            var envelope = ParseEnvelope(element);
            if (envelope.IsFailure)
            {
                return Result<ImmutableArray<ReceivedEvent>, EventBatchError>.Failure(
                    new EventBatchError(EventBatchError.InvalidEnvelopeCode, envelope.Error.Field, index));
            }

            received.Add(new ReceivedEvent(element, new StreamEvent(envelope.Value, element.Length)));
        }

        return Result<ImmutableArray<ReceivedEvent>, EventBatchError>.Success(received.MoveToImmutable());
    }

    private static Result<EventEnvelope, EnvelopeError> ParseEnvelope(ReadOnlyMemory<byte> element)
    {
        RawValue raw;
        try
        {
            raw = RawValueReader.Parse(element);
        }
        catch (JsonException)
        {
            return Result<EventEnvelope, EnvelopeError>.Failure(new EnvelopeError(EventLogSchema.EnvelopeRootField));
        }

        return EnvelopeParser.Parse(raw);
    }

    private static Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError> ReadRoot(ReadOnlyMemory<byte> body)
    {
        var reader = new Utf8JsonReader(body.Span, isFinalBlock: true, new JsonReaderState(ReaderOptions));
        if (!reader.Read() || reader.TokenType != JsonTokenType.StartObject)
        {
            return Invalid(EventBatchError.BodyField);
        }

        var elements = ReadMembers(ref reader, body);
        if (elements.IsFailure)
        {
            return elements;
        }

        // Anything after the root object throws, as the reader holds a single value.
        return reader.Read() ? Invalid(EventBatchError.BodyField) : elements;
    }

    /// <summary>The members of the root object: exactly one, <c>events</c>, by bytes and case.</summary>
    private static Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError> ReadMembers(ref Utf8JsonReader reader, ReadOnlyMemory<byte> body)
    {
        Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError>? elements = null;
        while (reader.Read() && reader.TokenType == JsonTokenType.PropertyName)
        {
            // "Events" or an escaped spelling of the key is another key.
            if (!reader.ValueTextEquals(EventBatchError.EventsField) || reader.ValueIsEscaped)
            {
                return Invalid(EventLogSchema.UnknownEnvelopeField);
            }

            if (elements is not null)
            {
                return Invalid(EventBatchError.EventsField);
            }

            elements = ReadEvents(ref reader, body);
            if (elements.IsFailure)
            {
                return elements;
            }
        }

        return reader.TokenType == JsonTokenType.EndObject && elements is not null ? elements : Invalid(EventBatchError.EventsField);
    }

    private static Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError> ReadEvents(ref Utf8JsonReader reader, ReadOnlyMemory<byte> body)
    {
        if (!reader.Read() || reader.TokenType != JsonTokenType.StartArray)
        {
            return Invalid(EventBatchError.EventsField);
        }

        var elements = ImmutableArray.CreateBuilder<ReadOnlyMemory<byte>>();
        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            if (elements.Count == CourtStreamLimits.MaxEventsPerRequest)
            {
                return Invalid(EventBatchError.EventsField);
            }

            var start = reader.TokenStartIndex;
            reader.Skip();
            var length = reader.BytesConsumed - start;
            if (length > CourtStreamLimits.MaxEnvelopeBytes)
            {
                return Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError>.Failure(
                    new EventBatchError(EventBatchError.EventTooLargeCode, Index: elements.Count));
            }

            elements.Add(body.Slice((int)start, (int)length));
        }

        return elements.Count < CourtStreamLimits.MinEventsPerRequest
            ? Invalid(EventBatchError.EventsField)
            : Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError>.Success(elements.ToImmutable());
    }

    private static Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError> Invalid(string field) =>
        Result<ImmutableArray<ReadOnlyMemory<byte>>, EventBatchError>.Failure(new EventBatchError(EventBatchError.BatchInvalidCode, field));
}
