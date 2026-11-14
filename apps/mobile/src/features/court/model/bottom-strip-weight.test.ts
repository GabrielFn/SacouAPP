import { describe, expect, test } from "vitest";

import { COURT_FLEX_WEIGHTS, LANDSCAPE_FLEX_WEIGHTS } from "../court.data";
import { bottomStripWeight } from "./bottom-strip-weight";
import { computeCourtLayout } from "./court-layout";

const NO_INSETS = { insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0 };

describe("bottomStripWeight", () => {
  test("landscape: the strip weighs the queue, so the zone and the half court do not change with the alert", () => {
    const layout = computeCourtLayout({ windowWidth: 844, windowHeight: 390, ...NO_INSETS });
    expect(bottomStripWeight(layout)).toBe(LANDSCAPE_FLEX_WEIGHTS.queue);
    // The zone height comes from the weights alone; the alert adds nothing to it.
    const total =
      LANDSCAPE_FLEX_WEIGHTS.bar + LANDSCAPE_FLEX_WEIGHTS.middle + bottomStripWeight(layout);
    expect(layout.zoneHeight).toBeCloseTo((390 * LANDSCAPE_FLEX_WEIGHTS.middle) / total);
  });

  test("portrait: the strip weighs the queue", () => {
    const layout = computeCourtLayout({ windowWidth: 390, windowHeight: 844, ...NO_INSETS });
    expect(bottomStripWeight(layout)).toBe(COURT_FLEX_WEIGHTS.queue);
  });
});
