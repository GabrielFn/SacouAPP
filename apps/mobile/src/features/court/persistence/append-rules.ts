import type { EventEnvelope } from "@sacou/match-engine";

/**
 * True when the envelopes are the next events of one device in this stream and batch, in order and
 * without a gap after `lastSequence`, the highest one the device already has in the stream.
 */
export function continuesLog(
  envelopes: readonly EventEnvelope[],
  {
    courtSessionId,
    batch,
    lastSequence,
  }: { courtSessionId: string; batch: number; lastSequence: number },
): boolean {
  const [first] = envelopes;
  return envelopes.every(
    (envelope, index) =>
      envelope.courtSessionId === courtSessionId &&
      envelope.deviceId === first?.deviceId &&
      envelope.batch === batch &&
      envelope.sequence === lastSequence + index + 1,
  );
}

/** The highest sequence a device has in a stream, or 0 when it has none. */
export function highestSequence(events: readonly EventEnvelope[], deviceId: string): number {
  return events.reduce(
    (highest, event) => (event.deviceId === deviceId ? Math.max(highest, event.sequence) : highest),
    0,
  );
}

/** True when each device's sequences are exactly 1..n, as only whole, ordered appends make them. */
export function hasContiguousSequences(events: readonly EventEnvelope[]): boolean {
  const byDevice = Object.groupBy(events, (event) => event.deviceId);
  return Object.values(byDevice).every((own) =>
    (own ?? [])
      .map((event) => event.sequence)
      .sort((a, b) => a - b)
      .every((sequence, index) => sequence === index + 1),
  );
}
