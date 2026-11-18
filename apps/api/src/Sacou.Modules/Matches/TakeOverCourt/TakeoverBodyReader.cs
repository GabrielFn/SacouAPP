using System.Text.Json;
using Sacou.Modules.Matches.Domain.CourtSessions;
using Sacou.Modules.Matches.Domain.CourtSessions.Writes;

namespace Sacou.Modules.Matches.TakeOverCourt;

/// <summary>
/// Reads the takeover body (ADR 0063, D2) into a <see cref="CourtTakeoverRequest"/>. A closed schema: malformed JSON,
/// not an object, a repeated key or a key more is the field <c>body</c>; a missing field, a null, a wrong type or an
/// integer past <c>long</c> is that field. Never a received key, byte or value in the answer.
/// </summary>
internal static class TakeoverBodyReader
{
    public const string BodyField = "body";

    private const int MaxDepth = 2;

    private static readonly JsonDocumentOptions Options = new()
    {
        AllowTrailingCommas = false,
        CommentHandling = JsonCommentHandling.Disallow,
        MaxDepth = MaxDepth,
        AllowDuplicateProperties = false,
    };

    private static readonly string[] Fields =
    [
        CourtTakeoverRequest.DeviceIdField,
        CourtTakeoverRequest.ExpectedBatchField,
        CourtTakeoverRequest.ExpectedEventCountField,
    ];

    public static Result<CourtTakeoverRequest, CourtWriteError> Read(ReadOnlyMemory<byte> body)
    {
        try
        {
            using var document = JsonDocument.Parse(body, Options);
            return ReadRoot(document.RootElement);
        }
        catch (JsonException)
        {
            // Not forwarded: the message names the offending byte and its position.
            return Invalid(BodyField);
        }
    }

    private static Result<CourtTakeoverRequest, CourtWriteError> ReadRoot(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object || root.EnumerateObject().Any(member => !Fields.Contains(member.Name, StringComparer.Ordinal)))
        {
            return Invalid(BodyField);
        }

        if (DeviceId(root) is not { } deviceId)
        {
            return Invalid(CourtTakeoverRequest.DeviceIdField);
        }

        if (Integer(root, CourtTakeoverRequest.ExpectedBatchField) is not { } expectedBatch)
        {
            return Invalid(CourtTakeoverRequest.ExpectedBatchField);
        }

        return Integer(root, CourtTakeoverRequest.ExpectedEventCountField) is { } expectedEventCount
            ? CourtTakeoverRequest.Create(deviceId, expectedBatch, expectedEventCount)
            : Invalid(CourtTakeoverRequest.ExpectedEventCountField);
    }

    /// <summary>
    /// The device id as text; null for a missing field, a non-string, or a string that does not transcode (a lone
    /// surrogate escape or invalid UTF-8), as in <c>RawValueReader</c>. The exception message is not forwarded: it can
    /// carry the received value.
    /// </summary>
    private static string? DeviceId(JsonElement root)
    {
        if (!root.TryGetProperty(CourtTakeoverRequest.DeviceIdField, out var device) || device.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        try
        {
            return device.GetString();
        }
        catch (Exception exception) when (exception is InvalidOperationException or ArgumentException)
        {
            return null;
        }
    }

    /// <summary>A JSON integer that fits a <c>long</c>; null for anything else, a fraction and an exponent included.</summary>
    private static long? Integer(JsonElement root, string field) =>
        root.TryGetProperty(field, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var number)
            ? number
            : null;

    private static Result<CourtTakeoverRequest, CourtWriteError> Invalid(string field) =>
        Result<CourtTakeoverRequest, CourtWriteError>.Failure(new CourtWriteError(CourtWriteErrorCode.TakeoverInvalid, Field: field));
}
