import type { EventEnvelope } from "@sacou/match-engine";

import type { IdGenerator } from "../ports/id-generator";

const MATCH_ID_PREFIX = "f0000000-0000-4000-8000-";
const MATCH_ID_DIGITS = 12;

export interface RelabelOptions {
  /** The match id written in the events to copy. */
  readonly from: string;
  /** The copy is match number n: `f0000000-...-00000000000n`. */
  readonly matchNumber: number;
  readonly ids: IdGenerator;
}

export function matchIdOf(matchNumber: number): string {
  return `${MATCH_ID_PREFIX}${String(matchNumber).padStart(MATCH_ID_DIGITS, "0")}`;
}

/**
 * A copy of the events of a match that is another match: new match id in every payload and new event
 * ids. The events of a match do not refer to each other except by `RevertedTo`, which the copied
 * blocks of the benchmark do not have.
 */
export function relabelEvents(
  events: readonly EventEnvelope[],
  { from, matchNumber, ids }: RelabelOptions,
): readonly EventEnvelope[] {
  const to = matchIdOf(matchNumber);
  return events.map((event) => ({
    ...event,
    eventId: ids.newId(),
    payload: JSON.parse(JSON.stringify(event.payload).split(from).join(to)) as EventEnvelope["payload"],
  }));
}
