import type { EventEnvelope } from "@sacou/match-engine";

/**
 * True when the envelopes are the next events of one device in this stream and batch, in order and
 * without a gap after `lastSequence`, the highest one the device already has in the stream.
 */
export function continuesLog(
  envelopes: readonly EventEnvelope[],
  { courtSessionId, batch, lastSequence }: { courtSessionId: string; batch: number; lastSequence: number },
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
