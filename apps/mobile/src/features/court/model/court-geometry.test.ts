import { describe, expect, test } from "vitest";

import { anchorAt, placeOnHalfCourt, ratioToPercentText, toPercentText } from "./court-geometry";
import { selectCourtScreen } from "./court-screen.selectors";
import { ROSTER, screen09 } from "./screen-scenarios.test.fixture";

const HALF_COURT_PX = 210;
/** Laranja is drawn from the catalog and matches the design to a few percent on both axes. */
const TOLERANCE_ORANGE = 0.07;
/**
 * The design draws Azul by hand: its depth (the y axis) is up to 0.4 away from the catalog, where
 * the receiving formation puts the front row deeper (screens 08, 09 and 25 do not agree among
 * themselves, E2.3). The catalog is the source, so only the width is held for Azul.
 */
const TOLERANCE_BLUE_WIDTH = 0.25;
const NO_DEPTH_CHECK = Number.POSITIVE_INFINITY;

/** Screen 09 (QuadraSol.dc.html), the left and top of each chip in pixels, by zone of the team. */
const DESIGN_ORANGE: Readonly<Record<number, readonly [number, number]>> = {
  1: [40, -24],
  2: [38, 176],
  3: [104, 176],
  4: [170, 176],
  5: [170, 62],
  6: [96, 62],
};
const DESIGN_BLUE: Readonly<Record<number, readonly [number, number]>> = {
  1: [172, 84],
  2: [166, 32],
  3: [104, 32],
  4: [40, 32],
  5: [46, 150],
  6: [112, 160],
};

describe("placing a point on the half court", () => {
  test("the team at the bottom is drawn as it is in the catalog", () => {
    expect(placeOnHalfCourt({ x: 0.25, y: 0.4 }, "bottom")).toEqual({ x: 25, y: 40 });
  });

  test("the team on top is turned half a turn: both axes are mirrored", () => {
    const place = placeOnHalfCourt({ x: 0.25, y: 0.4 }, "top");
    expect(place.x).toBeCloseTo(75);
    expect(place.y).toBeCloseTo(60);
  });

  test("the server stands behind the end line: below the square at the bottom, above it on top", () => {
    expect(placeOnHalfCourt({ x: 0.8, y: 1.1 }, "bottom").y).toBeGreaterThan(100);
    expect(placeOnHalfCourt({ x: 0.8, y: 1.1 }, "top").y).toBeLessThan(0);
  });

  test("the holder of a chip is twice as wide as the court and centered on the point", () => {
    expect(anchorAt({ x: 30, y: 62.5 })).toEqual({
      left: "-70.00%",
      top: "62.50%",
      width: "200.00%",
    });
    expect(toPercentText(33.333)).toBe("33.33%");
    expect(ratioToPercentText(0.5)).toBe("50.00%");
  });
});

describe("the chips of screen 09 against the design", () => {
  async function placed(side: "a" | "b") {
    const model = selectCourtScreen((await screen09()).timeline(), ROSTER);
    if (model === null) throw new Error("no court");
    return model.teams[side].chips.map((chip) => ({
      zone: chip.zone,
      place: placeOnHalfCourt(chip.point, side === "a" ? "top" : "bottom"),
    }));
  }

  test.each([
    ["a", DESIGN_ORANGE, TOLERANCE_ORANGE, TOLERANCE_ORANGE],
    ["b", DESIGN_BLUE, TOLERANCE_BLUE_WIDTH, NO_DEPTH_CHECK],
  ] as const)("team %s", async (side, design, widthTolerance, depthTolerance) => {
    for (const { zone, place } of await placed(side)) {
      const [left, top] = design[zone] ?? [0, 0];
      expect(Math.abs(place.x / 100 - left / HALF_COURT_PX)).toBeLessThanOrEqual(widthTolerance);
      expect(Math.abs(place.y / 100 - top / HALF_COURT_PX)).toBeLessThanOrEqual(depthTolerance);
    }
  });

  test("the server of Laranja is the only chip outside the square", async () => {
    const outside = (await placed("a")).filter(({ place }) => place.y < 0 || place.y > 100);
    expect(outside.map(({ zone }) => zone)).toEqual([1]);
  });
});
