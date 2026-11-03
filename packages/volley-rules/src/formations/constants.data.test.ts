import { createHash } from "node:crypto";

import { describe, expect, expectTypeOf, test } from "vitest";

import {
  FORMATION_CATALOG_VERSION,
  FORMATION_SYSTEMS,
  PLAYER_ROLES,
  ROTATION_KEYS,
  ROTATION_SLOTS,
} from "./constants.data.js";
import { FORMATION_CATALOG } from "./get-formation.js";
import type { FormationSystem, RotationKey, RotationSlot } from "./types.js";

/** The catalog of version 1, by content, so line endings and formatting of the file do not count. */
const CATALOG_V1_SHA256 = "f757ef1843eef9f70c9b96ee15c9d684a5322f750ad0672aaa2a05eb7ae4d8e9";

describe("formation catalog version", () => {
  test("a change to the catalog raises the version and keeps the previous catalog (ADR 0026)", () => {
    const hash = createHash("sha256").update(JSON.stringify(FORMATION_CATALOG)).digest("hex");

    expect(FORMATION_CATALOG_VERSION).toBe(1);
    expect(hash).toBe(CATALOG_V1_SHA256);
  });
});

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
