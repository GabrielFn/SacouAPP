import { expect, test } from "vitest";

import { COURT_FLEX_WEIGHTS, COURT_TOTAL_WEIGHT } from "../court.data";

test("the weights of the screen are the canvas of 844 and the strip is 104 of it", () => {
  expect(COURT_TOTAL_WEIGHT).toBe(844);
  expect(COURT_FLEX_WEIGHTS.strip).toBe(104);
});
