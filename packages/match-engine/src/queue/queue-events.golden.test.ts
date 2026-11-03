import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayEvents } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { VOLUME_TEST_TIMEOUT_MS } from "../event-log/volume-test-timeout.test.fixture.js";
import { SCORE_APPLIERS } from "../score/appliers.js";
import type { CourtSessionState, MemberId } from "../score/types.js";
import { getConsecutiveMatches } from "./consecutive-matches.js";

interface QueueEventCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected: unknown;
  readonly consecutiveMatches?: Readonly<Record<MemberId, number>>;
}

function readCases(): readonly QueueEventCase[] {
  const url = new URL("../../golden/queue-events.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly QueueEventCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "e1-match-started-records-the-queue",
  "e2-queue-changed-adds-who-arrived",
  "e2-queue-changed-replaces-and-never-accumulates",
  "e2-queue-changed-empties-the-queue",
  "e3-queue-changed-with-someone-on-the-court-is-rejected",
  "e3-queue-changed-with-a-court-member-in-a-queue-team-is-rejected",
  "e4-queue-changed-with-someone-repeated-is-rejected",
  "e5-queue-changed-with-96-is-applied",
  "e5-queue-changed-with-97-is-rejected",
  "e6-queue-team-with-0-is-rejected",
  "e6-queue-team-with-25-is-rejected",
  "e7-queue-changed-without-an-open-match-is-rejected",
  "e7-queue-changed-with-another-match-id-is-rejected",
  "e7-queue-changed-as-first-event-is-rejected",
  "e8-interleaved-writers-the-last-in-canonical-order-wins",
  "e9-revert-before-the-queue-changed-brings-back-the-queue-of-the-match-started",
  "e10-second-match-started-records-its-queue",
  "e10-revert-before-the-second-match-started-brings-back-the-queue-and-the-count",
  "e11-match-started-without-the-queue-is-rejected",
  "e11-match-started-with-a-null-queue-is-rejected",
  "e11-match-started-queue-overlapping-the-teams-is-rejected",
  "e12-match-ended-keeps-the-queue",
  "e13-consecutive-matches-across-three-matches",
  "e14-200-finished-matches-count-in-a-row",
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

function replayCase({ courtSessionId, initialState, events }: QueueEventCase) {
  const replayed = replayEvents(
    { courtSessionId, initialState, appliers: SCORE_APPLIERS },
    parseEnvelopes(events),
  );
  return replayed.ok ? { ok: true, ...replayed.value } : { ok: false, ...replayed.error };
}

describe("queue events golden", () => {
  test.each(CASES)(
    "$id",
    (goldenCase) => {
      const outcome = replayCase(goldenCase);

      expect(outcome).toStrictEqual(goldenCase.expected);
      // Key order is part of the contract with the C# port: `queue` comes after `finishedMatches`.
      expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
    },
    VOLUME_TEST_TIMEOUT_MS,
  );

  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });
});

describe("consecutive matches", () => {
  const withCount = CASES.filter(({ consecutiveMatches }) => consecutiveMatches !== undefined);

  test.each(withCount)(
    "$id",
    (goldenCase) => {
      const outcome = replayCase(goldenCase);
      const state = "state" in outcome ? outcome.state : null;
      if (state === null) {
        throw new Error("the case has no state");
      }
      const counted = Object.fromEntries(
        Object.keys(goldenCase.consecutiveMatches ?? {}).map((memberId) => [
          memberId,
          getConsecutiveMatches(state, memberId),
        ]),
      );

      expect(counted).toStrictEqual(goldenCase.consecutiveMatches);
    },
    VOLUME_TEST_TIMEOUT_MS,
  );

  test("the file checks the count in the cases that matter", () => {
    expect(withCount.length).toBeGreaterThan(0);
  });
});
