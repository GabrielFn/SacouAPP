import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import type { CourtSessionState } from "../score/types.js";
import { planNextMatch } from "./plan-next-match.js";
import type { NextMatchInput } from "./types.js";

interface PlanCase {
  readonly id: string;
  readonly input: {
    readonly state: CourtSessionState;
    readonly criterion: string;
    readonly criterionInput: unknown;
    readonly playersPerTeam: number;
    readonly exitMode: unknown;
    readonly winnerExit: unknown;
    readonly winnerCriterionInput: unknown;
  };
  readonly expected: unknown;
}

function readCases(): readonly PlanCase[] {
  const url = new URL("../../golden/queue-plans.json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as readonly PlanCase[];
}

const CASES = readCases();

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "q1-review-two-waiting-blue-loses-rafa-and-duda-leave",
  "q2-nobody-waiting-nobody-leaves",
  "q3-manual-end-without-a-winner-nobody-leaves",
  "q4-one-waiting-one-leaves-tie-goes-to-who-arrived-first",
  "q5-pairs-follow-the-team-not-the-criterion-with-the-rotation-off",
  "q6-tie-on-consecutive-goes-to-who-played-most-in-the-round",
  "q7-consecutive-matches-not-the-total-of-the-round",
  "q8-bench-and-libero-count-and-are-replaced",
  "q9-whole-team-waiting-the-loser-leaves-whole-and-the-singles-form-a-team",
  "q10-a-team-waits-behind-another-and-the-winner-on-side-b",
  "q11-six-singles-form-a-team-old-ones-first-then-who-left-in-team-order",
  "q12-loser-of-four-five-waiting-four-leave-five-stay-single",
  "q13-arrival-order-who-arrived-first-leaves",
  "q14-draw-the-first-of-the-shuffled-order-leave",
  "q15-manual-whoever-the-admin-chose",
  "r-manual-one-instead-of-two",
  "r-manual-three-instead-of-two",
  "r-manual-member-of-the-winner",
  "r-manual-someone-waiting",
  "r-manual-repeated",
  "r-draw-missing-a-member",
  "r-draw-with-a-repeat",
  "r-draw-with-an-outsider",
  "r-arrival-order-missing-a-candidate",
  "r-consecutive-without-the-arrival-order",
  "r-unknown-criterion-level",
  "r-criterion-input-null",
  "r-players-per-team-0",
  "r-players-per-team-25",
  "r-players-per-team-fraction",
  "r-with-a-match-open",
  "r-without-a-finished-match",
];

function planCase({ input }: PlanCase) {
  const { state, ...choice } = input;
  // The file holds criteria and inputs the type forbids, as the screen or a hostile caller may.
  const planned = planNextMatch(state, choice as NextMatchInput);
  return planned.ok ? { ok: true, ...planned.value } : { ok: false, ...planned.error };
}

describe("queue plans golden", () => {
  test.each(CASES)("$id", (goldenCase) => {
    const outcome = planCase(goldenCase);

    expect(outcome).toStrictEqual(goldenCase.expected);
    // Key order is part of the contract with the C# port.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });
});
