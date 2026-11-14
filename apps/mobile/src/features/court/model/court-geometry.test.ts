import { describe, expect, test } from "vitest";

import catalog from "../../../../../../packages/volley-rules/src/formations/formations.json";
import { placeOnHalfCourt, ratioToPercentText, toPercentText } from "./court-geometry";
import { selectCourtScreen } from "./court-screen.selectors";
import { ROSTER, screen09 } from "./screen-scenarios.test.fixture";

const HALF_COURT_PX = 210;
/** Laranja is drawn from the catalog and matches the design to a few percent on both axes. */
const TOLERANCE_ORANGE = 0.07;
/** Azul is held to the catalog itself (the design draws it by hand, E2.3 pendency). */
const TOLERANCE_CATALOG = 0.01;

/** Screen 09 (QuadraSol.dc.html), the left and top of each chip in pixels, by zone of the team. */
const DESIGN_ORANGE: Readonly<Record<number, readonly [number, number]>> = {
  1: [40, -24],
  2: [38, 176],
  3: [104, 176],
  4: [170, 176],
  5: [170, 62],
  6: [96, 62],
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

  test("landscape: the team on the left has its net on the right and its right hand down", () => {
    const nearNetOnRight = placeOnHalfCourt({ x: 0.9, y: 0.1 }, "left");
    expect(nearNetOnRight.x).toBeCloseTo(90);
    expect(nearNetOnRight.y).toBeCloseTo(90);
    expect(placeOnHalfCourt({ x: 0.8, y: 1.1 }, "left").x).toBeLessThan(0);
  });

  test("landscape: the team on the right has its net on the left and its right hand up", () => {
    const nearNetOnRight = placeOnHalfCourt({ x: 0.9, y: 0.1 }, "right");
    expect(nearNetOnRight.x).toBeCloseTo(10);
    expect(nearNetOnRight.y).toBeCloseTo(10);
    expect(placeOnHalfCourt({ x: 0.8, y: 1.1 }, "right").x).toBeGreaterThan(100);
  });

  test("the percent texts keep two decimals", () => {
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

  test("Laranja, on top, is where the design draws it", async () => {
    for (const { zone, place } of await placed("a")) {
      const [left, top] = DESIGN_ORANGE[zone] ?? [0, 0];
      expect(Math.abs(place.x / 100 - left / HALF_COURT_PX)).toBeLessThanOrEqual(TOLERANCE_ORANGE);
      expect(Math.abs(place.y / 100 - top / HALF_COURT_PX)).toBeLessThanOrEqual(TOLERANCE_ORANGE);
    }
  });

  /** Azul receives in rotation 1 on screen 09: the points of formations.json, unmirrored, by zone. */
  test("Azul, at the bottom, is where formations.json puts it", async () => {
    const receive = catalog.systems["5x1"].rotations["1"].receive;
    for (const { zone, place } of await placed("b")) {
      const point = receive[String(zone) as keyof typeof receive];
      expect(Math.abs(place.x / 100 - point.x)).toBeLessThanOrEqual(TOLERANCE_CATALOG);
      expect(Math.abs(place.y / 100 - point.y)).toBeLessThanOrEqual(TOLERANCE_CATALOG);
    }
  });

  test("the server of Laranja is the only chip outside the square", async () => {
    const outside = (await placed("a")).filter(({ place }) => place.y < 0 || place.y > 100);
    expect(outside.map(({ zone }) => zone)).toEqual([1]);
  });
});
