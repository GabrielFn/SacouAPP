import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayTimeline } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { SCORE_APPLIERS } from "../score/appliers.js";
import type { CourtSessionState } from "../score/types.js";
import { getPlayerStats } from "./player-stats.js";
import { getSideStats } from "./side-stats.js";

interface StatsEventCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly events: readonly unknown[];
  readonly expected: unknown;
}

function readCases(): readonly StatsEventCase[] {
  const url = new URL("../../golden/stats-events.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly StatsEventCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "s1-the-round-of-the-plan",
  "s2-the-libero-counts-only-on-the-court",
  "s3-rotation-off-counts-the-whole-team-in-order",
  "s4-the-bench-wins-with-a-zero-balance",
  "s5-no-winner-is-undecided-and-breaks-the-streak",
  "s6-manual-end-with-a-winner-counts-the-points-after-the-last-set",
  "s7-the-open-match-counts-nothing",
  "s8-reverted-lineup-and-point-count-nothing",
  "s9-empty-round",
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

function replayCase({ courtSessionId, initialState, events }: StatsEventCase) {
  const timeline = replayTimeline(
    { courtSessionId, initialState, appliers: SCORE_APPLIERS },
    parseEnvelopes(events),
  );
  if (!timeline.ok) {
    return { ok: false, ...timeline.error };
  }
  return {
    ok: true,
    playerStats: getPlayerStats(timeline.value),
    sideStats: getSideStats(timeline.value),
  };
}

describe("stats events golden", () => {
  test.each(CASES)("$id", (goldenCase) => {
    const outcome = replayCase(goldenCase);

    expect(outcome).toStrictEqual(goldenCase.expected);
    // Key order is part of the contract with the C# port.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });
});
