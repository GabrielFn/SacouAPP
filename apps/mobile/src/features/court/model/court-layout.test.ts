import { describe, expect, test } from "vitest";

import { createScaledTokens, shortSide } from "../../../theme/scale";
import {
  LANDSCAPE_FLEX_WEIGHTS,
  LANDSCAPE_TOTAL_HEIGHT_WEIGHT,
  LANDSCAPE_TOTAL_WIDTH_WEIGHT,
  LANDSCAPE_WIDTH_WEIGHTS,
} from "../court.data";
import { computeCourtLayout, type CourtLayoutInput } from "./court-layout";
import { squareOrigin } from "./team-markers";
import { scoreTextSize } from "./score-display";

const NO_INSETS = { insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0 };
const MIN_SHARE = 0.38;
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

  test("at the size of the layout (844 x 390) it gives back its pixels", () => {
    const layout = computeCourtLayout(input(844, 390));
    expect(layout.zoneWidth).toBeCloseTo(382, 3);
    expect(layout.zoneHeight).toBeCloseTo(294, 3);
    expect(layout.sideWidth).toBeCloseTo(103, 3);
    expect(layout.halfCourtSide).toBeCloseTo(256, 3);
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

  test.each(PHONES)(
    "the square fits its zone and the column leaves it room at $width x $height",
    (phone) => {
      for (const insetLeft of [0, NOTCH]) {
        const layout = computeCourtLayout(input(phone.width, phone.height, { insetLeft }));
        expect(layout.halfCourtSide).toBeLessThanOrEqual(layout.zoneHeight + TOLERANCE);
        expect(layout.edgeInset + layout.sideWidth + layout.halfCourtSide).toBeLessThanOrEqual(
          layout.zoneWidth + TOLERANCE,
        );
      }
    },
  );

  test.each(PHONES)("the score is 38% of the zone or more at $width x $height", (phone) => {
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

describe("the half court touches the net", () => {
  const SCREENS = [
    { width: 640, height: 360 },
    { width: 844, height: 390 },
    { width: 932, height: 430 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
  ] as const;

  test.each(SCREENS)(
    "its edge on the net side is the edge of the net column at $width x $height",
    (screen) => {
      const layout = computeCourtLayout(input(screen.width, screen.height));
      const ends =
        layout.kind === "landscape" ? (["left", "right"] as const) : (["top", "bottom"] as const);
      for (const end of ends) {
        const origin = squareOrigin(layout, end);
        if (end === "left") expect(origin.x + layout.halfCourtSide).toBe(layout.zoneWidth);
        if (end === "right") expect(origin.x).toBe(0);
        if (end === "top") expect(origin.y + layout.halfCourtSide).toBe(layout.zoneHeight);
        if (end === "bottom") expect(origin.y).toBe(0);
      }
    },
  );
});

describe("the net column holds its two buttons", () => {
  const SCREENS = [
    { width: 640, height: 360 },
    { width: 844, height: 390 },
    { width: 932, height: 430 },
  ] as const;

  test.each(SCREENS)(
    "each button is 44 wide or more and stays inside at $width x $height",
    (screen) => {
      const layout = computeCourtLayout(input(screen.width, screen.height));
      if (layout.kind !== "landscape") throw new Error("not landscape");
      const tokens = createScaledTokens({
        windowWidth: shortSide(screen.width, screen.height),
        fontScale: 1,
      });
      const around = (tokens.court.borderWidths.frame + tokens.court.spacing.hairGap) * 2;
      const button = layout.netWidth - around;
      expect(button).toBeGreaterThanOrEqual(tokens.sizes.minTouchTarget);
      expect(layout.zoneWidth * 2 + layout.netWidth).toBeCloseTo(screen.width, 3);
    },
  );
});

describe("the court sits high enough for the names of its bottom row", () => {
  const SCREENS = [
    { width: 640, height: 360 },
    { width: 844, height: 390 },
    { width: 932, height: 430 },
  ] as const;

  test.each(SCREENS)(
    "below the square there is room for a chip and a name, above it less, at $width x $height",
    (screen) => {
      const layout = computeCourtLayout(input(screen.width, screen.height));
      const tokens = createScaledTokens({
        windowWidth: shortSide(screen.width, screen.height),
        fontScale: 1,
      });
      for (const end of ["left", "right"] as const) {
        const origin = squareOrigin(layout, end);
        const below = layout.zoneHeight - origin.y - layout.halfCourtSide;
        expect(origin.y).toBeLessThan(below);
        expect(origin.y).toBeGreaterThanOrEqual(0);
        expect(below).toBeGreaterThanOrEqual(tokens.court.sizes.chip / 2);
      }
    },
  );
});
