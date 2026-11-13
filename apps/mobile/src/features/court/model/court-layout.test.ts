import { describe, expect, test } from "vitest";

import {
  LANDSCAPE_FLEX_WEIGHTS,
  LANDSCAPE_TOTAL_HEIGHT_WEIGHT,
  LANDSCAPE_TOTAL_WIDTH_WEIGHT,
  LANDSCAPE_WIDTH_WEIGHTS,
} from "../court.data";
import { computeCourtLayout, type CourtLayoutInput } from "./court-layout";
import { scoreTextSize } from "./score-display";

const NO_INSETS = { insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0 };
const MIN_SHARE = 0.45;
const TOLERANCE = 0.0001;

function input(windowWidth: number, windowHeight: number, extra = {}): CourtLayoutInput {
  return { windowWidth, windowHeight, ...NO_INSETS, ...extra };
}

describe("which layout the window asks for", () => {
  test("wider than tall is landscape", () => {
    expect(computeCourtLayout(input(844, 390)).kind).toBe("landscape");
  });

  test("taller than wide is portrait", () => {
    expect(computeCourtLayout(input(390, 844)).kind).toBe("portrait");
  });

  test("a square counts as portrait, the fallback", () => {
    expect(computeCourtLayout(input(600, 600)).kind).toBe("portrait");
  });
});

describe("the landscape layout", () => {
  const PHONES = [
    { width: 640, height: 360 },
    { width: 844, height: 390 },
    { width: 932, height: 430 },
  ] as const;
  const NOTCH = 48;

  test("at the size of the sketch it gives back its pixels", () => {
    const layout = computeCourtLayout(input(844, 390));
    expect(layout.zoneWidth).toBeCloseTo(366, 3);
    expect(layout.zoneHeight).toBeCloseTo(294, 3);
    expect(layout.sideWidth).toBeCloseTo(122, 3);
    expect(layout.halfCourtSide).toBeCloseTo(232, 3);
  });

  test.each(PHONES)("the weights add up to the usable area at $width x $height", (phone) => {
    const layout = computeCourtLayout(input(phone.width, phone.height));
    if (layout.kind !== "landscape") throw new Error("not landscape");
    expect(layout.zoneWidth * 2 + layout.netWidth).toBeCloseTo(phone.width, 3);
    const barAndQueue = LANDSCAPE_FLEX_WEIGHTS.bar + LANDSCAPE_FLEX_WEIGHTS.queue;
    const barAndQueueHeight = (barAndQueue / LANDSCAPE_TOTAL_HEIGHT_WEIGHT) * phone.height;
    expect(layout.zoneHeight + barAndQueueHeight).toBeCloseTo(phone.height, 3);
    expect(LANDSCAPE_WIDTH_WEIGHTS.zone * 2 + LANDSCAPE_WIDTH_WEIGHTS.net).toBe(
      LANDSCAPE_TOTAL_WIDTH_WEIGHT,
    );
  });

  test.each(PHONES)("with a notch of 48 at the left, $width x $height still adds up", (phone) => {
    const layout = computeCourtLayout(input(phone.width, phone.height, { insetLeft: NOTCH }));
    if (layout.kind !== "landscape") throw new Error("not landscape");
    expect(layout.zoneWidth * 2 + layout.netWidth).toBeCloseTo(phone.width - NOTCH, 3);
  });

  test.each(PHONES)("the square fits its zone and the column leaves it room at $width x $height", (phone) => {
    for (const insetLeft of [0, NOTCH]) {
      const layout = computeCourtLayout(input(phone.width, phone.height, { insetLeft }));
      expect(layout.halfCourtSide).toBeLessThanOrEqual(layout.zoneHeight + TOLERANCE);
      expect(layout.edgeInset + layout.sideWidth + layout.halfCourtSide).toBeLessThanOrEqual(
        layout.zoneWidth + TOLERANCE,
      );
    }
  });

  test.each(PHONES)("the score is 45% of the zone or more at $width x $height", (phone) => {
    for (const insetLeft of [0, NOTCH]) {
      const layout = computeCourtLayout(input(phone.width, phone.height, { insetLeft }));
      const { fontSize } = scoreTextSize({ ...layout, score: 18 });
      expect(fontSize / layout.zoneHeight).toBeGreaterThanOrEqual(MIN_SHARE - TOLERANCE);
    }
  });

  test("the insets of the top and bottom take their height out of the zones", () => {
    const free = computeCourtLayout(input(844, 390));
    const cut = computeCourtLayout(input(844, 390, { insetTop: 20, insetBottom: 20 }));
    expect(cut.zoneHeight).toBeLessThan(free.zoneHeight);
  });
});
