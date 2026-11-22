namespace Sacou.Modules.Matches.TakeOverCourt;

/// <summary>
/// The body <c>{ deviceId, expectedBatch, expectedEventCount }</c>, for the contract only: the endpoint reads the raw
/// bytes with <see cref="TakeoverBodyReader"/>, so a key more, a null or a number past <c>long</c> is a 400
/// <c>matches.takeover-invalid</c> with the field, never a 500 nor an echo (ADR 0063, D2).
/// </summary>
internal sealed record TakeOverCourtRequest(Guid DeviceId, long ExpectedBatch, long ExpectedEventCount);

/// <summary>
/// The batch the caller writes from now on, how many events the stream had when it began (E4.11), the largest sequence
/// of the device in the stream, 0 when it never wrote (ADR 0063, D3), and the events stored at the takeover, read under
/// the same lock as <c>lastSequence</c>: the app imports exactly these (R98), since the pair already writing gets back a
/// batch that began before its own events.
/// </summary>
internal sealed record TakeOverCourtResponse(long Batch, long EventsBefore, long LastSequence, long EventCount);
