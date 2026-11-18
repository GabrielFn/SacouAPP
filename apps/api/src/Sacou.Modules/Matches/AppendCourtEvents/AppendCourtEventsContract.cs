using System.Collections.Immutable;
using System.Text.Json.Nodes;
using Sacou.Shared.Results;

namespace Sacou.Modules.Matches.AppendCourtEvents;

/// <summary>
/// The body <c>{ "events": [ envelope, ... ] }</c>, for the contract only: the endpoint reads the raw bytes with
/// <c>EventBatchReader</c>, never through this record (ADR 0060, D8 step 2). An envelope is the one of ADR 0009,
/// with every key known; a key more is a 400.
/// </summary>
internal sealed record AppendCourtEventsRequest(IReadOnlyList<JsonObject> Events)
{
    public override string ToString() => nameof(AppendCourtEventsRequest);
}

/// <summary>
/// 200 for a write and for a pure resend alike: <see cref="LastSequence"/> is the largest sequence of the device in
/// the stream after the write, and <see cref="Stored"/> how many events were new (ADR 0060, D1). Nothing is echoed.
/// </summary>
internal sealed record AppendCourtEventsResponse(long LastSequence, int Stored);

/// <summary>
/// A refusal with the extensions of ADR 0060, D15: each one a number, a UUID the parser proved, or a value of a
/// closed list. Never a member id nor received content.
/// </summary>
internal sealed record CourtProblem(Error Error, ImmutableDictionary<string, object?> Extensions)
{
    public const string EventIdExtension = "eventId";
    public const string FieldExtension = "field";
    public const string IndexExtension = "index";
    public const string ReasonExtension = "reason";
    public const string LimitExtension = "limit";
    public const string ExpectedSequenceExtension = "expectedSequence";

    public static CourtProblem Of(Error error) => new(error, ImmutableDictionary<string, object?>.Empty);

    public override string ToString() => $"{nameof(CourtProblem)}({Error.Code})";
}
