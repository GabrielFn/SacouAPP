import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { parseEventEnvelope } from "../event-log/parse-envelope.js";
import { replayTimeline } from "../event-log/replay-events.js";
import type { EventEnvelope } from "../event-log/types.js";
import { SCORE_APPLIERS } from "../score/appliers.js";
import type { CourtSessionState } from "../score/types.js";
import { getRoundSummary } from "./round-summary.js";
import type { RoundSummaryOptions } from "./types.js";

interface RoundSummaryCase {
  readonly id: string;
  readonly courtSessionId: string;
  readonly initialState: CourtSessionState;
  readonly options: RoundSummaryOptions;
  readonly events: readonly unknown[];
  readonly expected: unknown;
}

function readCases(): readonly RoundSummaryCase[] {
  const url = new URL("../../golden/round-summary.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly RoundSummaryCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "r1-the-round-of-the-plan",
  "r2-the-balance-ties-and-the-share-of-wins-decides",
  "r3-then-the-longest-streak-decides",
  "r4-then-more-matches-decide-two-of-three-ties-four-of-six",
  "r5-then-the-first-appearance-decides-never-the-id",
  "r6-the-open-match-changes-nothing",
  "r7-empty-round-on-the-sand",
  "r8-mvp-off-keeps-the-players",
  "r9-mvp-by-stats-off-keeps-the-players",
  "r10-individual-points-off-zeroes-the-kinds",
  "r11-no-winner-is-not-a-win-in-the-share",
  "r12-beach-2x2-the-day-of-screen-12b",
  "r13-beach-ties-by-losses-then-streak",
  "r14-beach-ties-by-point-balance-then-first-match",
  "r15-beach-remade-pair-is-another-team",
  "r16-beach-4x4-with-a-team-of-three",
  "r17-tied-highlights-are-null",
  "r18-main-side-is-the-side-of-most-matches",
  "r19-main-side-on-a-tie-is-the-last-match",
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

function replayCase({ courtSessionId, initialState, options, events }: RoundSummaryCase) {
  const timeline = replayTimeline(
    { courtSessionId, initialState, appliers: SCORE_APPLIERS },
    parseEnvelopes(events),
  );
  if (!timeline.ok) {
    return { ok: false, ...timeline.error };
  }
  return { ok: true, roundSummary: getRoundSummary(timeline.value, options) };
}

describe("round summary golden", () => {
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
