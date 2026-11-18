import type { EventEnvelope } from "@sacou/match-engine";

export interface PendingScope {
  readonly deviceId: string;
  /** The batch this device writes now: an event of an older batch is never sent again. */
  readonly batch: number;
  /** The highest sequence of this device the server confirmed. */
  readonly ackedSequence: number;
}

/**
 * What still has to reach the server, derived and never stored (ADR 0067, D1): the events of this
 * device in its batch above the confirmed cursor, in the order of the log.
 */
export function pendingEvents(
  events: readonly EventEnvelope[],
  { deviceId, batch, ackedSequence }: PendingScope,
): readonly EventEnvelope[] {
  return events.filter(
    (event) =>
      event.deviceId === deviceId && event.batch === batch && event.sequence > ackedSequence,
  );
}

const POINT_SCORED = "PointScored";

/** How many of these events are points, for the warning of "Sair" (question 84). */
export function countPoints(events: readonly EventEnvelope[]): number {
  return events.filter((event) => event.type === POINT_SCORED).length;
}
