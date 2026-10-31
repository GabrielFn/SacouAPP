import { describe, expect, expectTypeOf, test } from "vitest";

import {
  FORMATION_SYSTEMS,
  PLAYER_ROLES,
  ROTATION_KEYS,
  ROTATION_SLOTS,
} from "./constants.data.js";
import type { FormationSystem, RotationKey, RotationSlot } from "./types.js";

describe("formation constants", () => {
  test.each<[string, readonly unknown[]]>([
    ["FORMATION_SYSTEMS", FORMATION_SYSTEMS],
    ["PLAYER_ROLES", PLAYER_ROLES],
    ["ROTATION_KEYS", ROTATION_KEYS],
    ["ROTATION_SLOTS", ROTATION_SLOTS],
  ])("%s rejects mutation", (_name, constant) => {
    const mutable = constant as unknown[];
    const original = [...constant];

    expect(() => mutable.push("extra")).toThrow(TypeError);
    expect(() => {
      mutable[0] = "changed";
    }).toThrow(TypeError);
    expect(() => mutable.reverse()).toThrow(TypeError);
    expect(constant).toStrictEqual(original);
  });

  test("keep their literal types", () => {
    expectTypeOf<FormationSystem>().toEqualTypeOf<"5x1" | "6x2" | "4x2" | "livre">();
    expectTypeOf<RotationSlot>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6>();
    expectTypeOf<RotationKey>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5 | 6>();
  });
});
