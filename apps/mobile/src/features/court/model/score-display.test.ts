import { describe, expect, test } from "vitest";

import { COURT_ZONE_RATIOS, SCORE_ZONE_RATIO } from "../court.data";
import { computeCourtLayout } from "./court-layout";
import { countDigits, scoreTextSize } from "./score-display";

const NO_INSETS = { insetTop: 0, insetBottom: 0 };
const SCREENS = [
  { windowWidth: 320, windowHeight: 568 },
  { windowWidth: 390, windowHeight: 844 },
  { windowWidth: 600, windowHeight: 960 },
] as const;
/** The score is at least 45% of the zone (produto.md:134). */
const MIN_SHARE = 0.45;
const DIGIT_WIDTH_EM = 0.46;
const THREE_DIGITS = 3;

function sizeOf(score: number, screen: (typeof SCREENS)[number]) {
  const layout = computeCourtLayout({ ...screen, ...NO_INSETS });
  return { layout, text: scoreTextSize({ ...layout, score }) };
}

describe("digits", () => {
  test.each([
    [0, 1],
    [9, 1],
    [10, 2],
    [99, 2],
    [100, 3],
    [9999, 4],
    [Number.MAX_SAFE_INTEGER, 16],
  ])("%s has %s digits", (score, digits) => {
    expect(countDigits(score)).toBe(digits);
  });
});

describe("the score has no ceiling", () => {
  test.each(SCREENS)("up to two digits it is 45% of the zone or more at %o", (screen) => {
    const { layout } = sizeOf(0, screen);
    for (const score of [0, 9, 10, 99]) {
      const { fontSize } = sizeOf(score, screen).text;
      expect(fontSize / layout.zoneHeight).toBeGreaterThanOrEqual(MIN_SHARE);
    }
  });

  test.each(SCREENS)("two digits fit the width of the side column at %o", (screen) => {
    const { layout, text } = sizeOf(99, screen);
    expect(text.fontSize * 2 * DIGIT_WIDTH_EM).toBeLessThanOrEqual(layout.sideWidth + 1);
  });

  test.each(SCREENS)(
    "three digits are smaller than two, four smaller than three at %o",
    (screen) => {
      const [two, three, four] = [99, 100, 1000].map(
        (score) => sizeOf(score, screen).text.fontSize,
      );
      expect(three).toBeLessThan(two ?? 0);
      expect(four).toBeLessThan(three ?? 0);
    },
  );

  test.each([100, 300, 1000, 9999, Number.MAX_SAFE_INTEGER])(
    "%s still fits the side column at any screen",
    (score) => {
      for (const screen of SCREENS) {
        const { layout, text } = sizeOf(score, screen);
        expect(text.fontSize).toBeGreaterThan(0);
        expect(text.fontSize * countDigits(score) * DIGIT_WIDTH_EM).toBeLessThanOrEqual(
          layout.sideWidth + 1,
        );
      }
    },
  );

  test("the line is tighter than the font and the tracking is negative", () => {
    const { text } = sizeOf(18, SCREENS[1]);
    expect(text.lineHeight).toBeLessThan(text.fontSize);
    expect(text.letterSpacing).toBeLessThan(0);
  });

  test("the canvas gives the 132 of the design", () => {
    const { text } = sizeOf(18, SCREENS[1]);
    expect(text.fontSize).toBeCloseTo(132, 0);
    expect(SCORE_ZONE_RATIO).toBeGreaterThanOrEqual(MIN_SHARE);
    expect(THREE_DIGITS).toBe(3);
  });
});

describe("the layout from the window", () => {
  test("at the canvas size it gives back the pixels of the design", () => {
    const layout = computeCourtLayout({ windowWidth: 390, windowHeight: 844, ...NO_INSETS });
    expect(layout.zoneHeight).toBeCloseTo(288, 5);
    expect(layout.sideWidth).toBeCloseTo(140, 5);
    expect(layout.halfCourtSide).toBeCloseTo(210, 5);
  });

  test("the insets take their height out of the zones", () => {
    const free = computeCourtLayout({ windowWidth: 390, windowHeight: 844, ...NO_INSETS });
    const cut = computeCourtLayout({
      windowWidth: 390,
      windowHeight: 844,
      insetTop: 40,
      insetBottom: 20,
    });
    expect(cut.zoneHeight).toBeLessThan(free.zoneHeight);
  });

  test("the half court is never taller than its zone, on a short screen or a tablet", () => {
    for (const screen of [
      { windowWidth: 360, windowHeight: 500 },
      { windowWidth: 768, windowHeight: 1024 },
    ]) {
      const layout = computeCourtLayout({ ...screen, ...NO_INSETS });
      expect(layout.halfCourtSide).toBeLessThanOrEqual(layout.zoneHeight);
    }
  });

  test("the columns of the zone sum to the full width", () => {
    const { edge, side } = COURT_ZONE_RATIOS;
    expect(edge * 2 + side).toBeLessThan(1);
  });

  test("a window smaller than its insets does not give negative sizes", () => {
    const layout = computeCourtLayout({
      windowWidth: 300,
      windowHeight: 50,
      insetTop: 40,
      insetBottom: 40,
    });
    expect(layout.zoneHeight).toBe(0);
  });
});
