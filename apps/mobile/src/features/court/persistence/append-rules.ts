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

/**
 * True when each device's sequences are exactly 1..n in the order given, which is the order of the
 * positions in the file: only whole, ordered appends make that.
 */
export function hasContiguousSequences(events: readonly EventEnvelope[]): boolean {
  const outcome = events.reduce<{ valid: boolean; seen: Readonly<Record<string, number>> }>(
    ({ valid, seen }, event) => {
      const expected = (seen[event.deviceId] ?? 0) + 1;
      return {
        valid: valid && event.sequence === expected,
        seen: { ...seen, [event.deviceId]: expected },
      };
    },
    { valid: true, seen: {} },
  );
  return outcome.valid;
}
