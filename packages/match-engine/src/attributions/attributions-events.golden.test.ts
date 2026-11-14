import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { REVERTED_TO_EVENT_TYPE } from "../event-log/constants.data.js";
import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayTimeline } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { SCORE_APPLIERS } from "../score/appliers.js";
import { POINT_ATTRIBUTED_EVENT_TYPE } from "../score/constants.data.js";
import type { CourtSessionState } from "../score/types.js";
import { resolvePointAttributions } from "./resolve.js";

interface AttributionEventCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected: unknown;
}

function readCases(): readonly AttributionEventCase[] {
  const url = new URL("../../golden/attributions-events.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly AttributionEventCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "a1-attributed-at-once",
  "a2-attributed-later",
  "a3-the-last-attribution-wins",
  "a4-opponent-error-has-no-author",
  "a5-undone-attribution-is-not-counted",
  "a6-attribution-of-a-reverted-point-is-ignored",
  "a7-attribution-of-an-event-that-is-not-a-point-is-ignored",
  "a8-attribution-of-another-match-is-rejected",
  "a9-attribution-to-a-point-of-an-earlier-match-is-ignored",
  "a10-author-of-the-other-team-is-ignored",
  "a11-an-ignored-attribution-does-not-erase-the-valid-one",
  "a12-author-outside-the-match-is-rejected",
  "a13-attribution-before-the-point-in-the-canonical-order",
  "a14-attribution-in-a-decided-set",
  "a15-attribution-in-a-closed-set",
  "a16-attribution-after-the-end-of-the-match-is-rejected",
  "a17-a-guest-without-an-account-plays-and-scores-by-member-id",
];

function parseEnvelopes(events: readonly unknown[]): readonly EventEnvelope[] {
  return events.map((raw) => {
    const envelope = parseEventEnvelope(raw);
    if (!envelope.ok) {
      throw new Error(`invalid envelope: ${envelope.error.field}`);
    }
    return envelope.value;
  });
}

function replayCase(
  { courtSessionId, initialState }: AttributionEventCase,
  events: readonly EventEnvelope[],
) {
  const timeline = replayTimeline(
    { courtSessionId, initialState, appliers: SCORE_APPLIERS },
    events,
  );
  if (!timeline.ok) {
    return { ok: false, ...timeline.error };
  }
  const { entries } = timeline.value;
  return {
    ok: true,
    state: entries.at(-1)?.state ?? initialState,
    activeEventIds: entries.map(({ event }) => event.eventId),
    attributions: resolvePointAttributions(timeline.value),
  };
}

describe("attributions events golden", () => {
  test.each(CASES)("$id", (goldenCase) => {
    const outcome = replayCase(goldenCase, parseEnvelopes(goldenCase.events));

    expect(outcome).toStrictEqual(goldenCase.expected);
    // Key order is part of the contract with the C# port.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });
});

function hasNoRevert(events: readonly EventEnvelope[]): boolean {
  return events.every(({ type }) => type !== REVERTED_TO_EVENT_TYPE);
}

describe("an attribution changes nothing in the state", () => {
  const accepted = CASES.filter((goldenCase) => {
    const outcome = replayCase(goldenCase, parseEnvelopes(goldenCase.events));
    return outcome.ok && hasNoRevert(parseEnvelopes(goldenCase.events));
  });

  test.each(accepted)("$id", (goldenCase) => {
    const events = parseEnvelopes(goldenCase.events);
    const withAll = replayCase(goldenCase, events);
    const withNone = replayCase(
      goldenCase,
      events.filter(({ type }) => type !== POINT_ATTRIBUTED_EVENT_TYPE),
    );

    expect("state" in withNone ? withNone.state : null).toStrictEqual(
      "state" in withAll ? withAll.state : undefined,
    );
  });

  test("the file checks the state in the cases that matter", () => {
    expect(accepted.length).toBeGreaterThan(0);
  });
});
