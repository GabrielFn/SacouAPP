import { readFileSync } from "node:fs";

import type { FormationPhase, FormationSystem, SetterZone } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { getServeAlignment } from "./serve-alignment.js";
import type { MemberId } from "./types.js";

interface AlignmentCase {
  readonly id: string;
  readonly input: {
    readonly system: FormationSystem;
    readonly lineup: readonly MemberId[];
    readonly setterZone: SetterZone;
    readonly phase: FormationPhase;
  };
  readonly expected: unknown;
}

const url = new URL("../../golden/serve-alignment.json", import.meta.url);
const CASES = JSON.parse(readFileSync(url, "utf8")) as readonly AlignmentCase[];

/** Literal, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = [
  "5x1-zone-1-receiving",
  "5x1-zone-1-serving",
  "5x1-zone-6-receiving",
  "5x1-zone-6-serving",
  "5x1-zone-5-receiving",
  "5x1-zone-5-serving",
  "5x1-zone-4-receiving",
  "5x1-zone-4-serving",
  "5x1-zone-3-receiving",
  "5x1-zone-3-serving",
  "5x1-zone-2-receiving",
  "5x1-zone-2-serving",
  "6x2-zone-1-receiving",
  "6x2-zone-1-serving",
  "6x2-zone-6-receiving",
  "6x2-zone-6-serving",
  "6x2-zone-5-receiving",
  "6x2-zone-5-serving",
  "6x2-zone-4-receiving",
  "6x2-zone-4-serving",
  "6x2-zone-3-receiving",
  "6x2-zone-3-serving",
  "6x2-zone-2-receiving",
  "6x2-zone-2-serving",
  "4x2-zone-1-receiving",
  "4x2-zone-1-serving",
  "4x2-zone-6-receiving",
  "4x2-zone-6-serving",
  "4x2-zone-5-receiving",
  "4x2-zone-5-serving",
  "4x2-zone-4-receiving",
  "4x2-zone-4-serving",
  "4x2-zone-3-receiving",
  "4x2-zone-3-serving",
  "4x2-zone-2-receiving",
  "4x2-zone-2-serving",
  "livre-zone-1-receiving",
  "livre-zone-1-serving",
  "livre-zone-6-receiving",
  "livre-zone-6-serving",
  "livre-zone-5-receiving",
  "livre-zone-5-serving",
  "livre-zone-4-receiving",
  "livre-zone-4-serving",
  "livre-zone-3-receiving",
  "livre-zone-3-serving",
  "livre-zone-2-receiving",
  "livre-zone-2-serving",
  "6x2-zone-3-receiving-lineup-out-of-uuid-order",
];

describe("serve alignment golden", () => {
  test.each(CASES)("$id", ({ input: { system, lineup, setterZone, phase }, expected }) => {
    const alignment = getServeAlignment({ libero: null, lineup, setterZone, system }, phase);
    const { formationKey, actingSetter, slots } = alignment;
    const outcome = { formationKey, actingSetter, slots };

    expect(outcome).toStrictEqual(expected);
    // Key order is part of the contract with the C# port.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(expected));
    expect(alignment).toMatchObject({ system, setterZone, phase });
  });

  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });
});
