import { describe } from "vitest";

import { testPlanGolden } from "./queue-golden.test.fixture.js";

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

describe("queue plans golden", () => {
  testPlanGolden("queue-plans.json", EXPECTED_IDS);
});
