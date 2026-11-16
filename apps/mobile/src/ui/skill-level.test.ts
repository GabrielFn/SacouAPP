import { describe, expect, test } from "vitest";

import {
  LEVEL_SHORTCUTS,
  SKILL_LEVEL,
  canStep,
  formatLevel,
  levelOf,
  stepLevel,
  tenthsOf,
} from "./skill-level";

describe("the scale of a level (perfil-e-nota.md)", () => {
  test.each([
    [1, 10],
    [3.5, 35],
    [4, 40],
    [5, 50],
    [0.35 * 10, 35],
  ])("%s on the wire is %s tenths", (level, tenths) => {
    expect(tenthsOf(level)).toBe(tenths);
  });

  test.each([[4.25], [0.5], [5.5], [0], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    "%s is off the scale",
    (level) => {
      expect(tenthsOf(level)).toBeNull();
    },
  );

  test("no level is no level", () => {
    expect(tenthsOf(null)).toBeNull();
  });

  test("half a point a step, and off at the limits", () => {
    expect(stepLevel(35, 1)).toBe(40);
    expect(stepLevel(35, -1)).toBe(30);
    expect(canStep(SKILL_LEVEL.minTenths, -1)).toBe(false);
    expect(canStep(SKILL_LEVEL.maxTenths, 1)).toBe(false);
    expect(stepLevel(SKILL_LEVEL.minTenths, -1)).toBe(SKILL_LEVEL.minTenths);
    expect(stepLevel(SKILL_LEVEL.maxTenths, 1)).toBe(SKILL_LEVEL.maxTenths);
  });

  test("the shortcuts are 1 to 5 and the text has a comma", () => {
    expect(LEVEL_SHORTCUTS.map(formatLevel)).toEqual(["1,0", "2,0", "3,0", "4,0", "5,0"]);
    expect(formatLevel(35)).toBe("3,5");
    expect(levelOf(35)).toBe(3.5);
  });
});
