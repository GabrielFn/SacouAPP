import { readFileSync } from "node:fs";

import type { FormationPhase, FormationSystem, SetterZone } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { getLiberoSlot } from "./rotation-rules.js";
import { getServeAlignment } from "./serve-alignment.js";
import type { MemberId, TeamLibero } from "./types.js";

interface LiberoAlignmentCase {
  readonly id: string;
  readonly input: {
    readonly system: FormationSystem;
    readonly lineup: readonly MemberId[];
    readonly setterZone: SetterZone;
    readonly phase: FormationPhase;
    readonly libero: TeamLibero;
  };
  readonly expected: unknown;
}

const url = new URL("../../golden/libero-alignment.json", import.meta.url);
const CASES = JSON.parse(readFileSync(url, "utf8")) as readonly LiberoAlignmentCase[];

const ZONES = [1, 6, 5, 4, 3, 2] as const;
const PHASES = ["receiving", "serving"] as const;
const GROUPS = ["5x1-middles", "6x2-middles", "5x1-mb2-only", "5x1-oh2-only"] as const;

/** Built from literals, never read from the file: a case that disappears must fail. */
const EXPECTED_IDS: readonly string[] = GROUPS.flatMap((group) =>
  ZONES.flatMap((zone) => PHASES.map((phase) => `${group}-zone-${String(zone)}-${phase}`)),
);

describe("libero alignment golden", () => {
  test.each(CASES)("$id", ({ input: { system, lineup, setterZone, phase, libero }, expected }) => {
    const teamState = { libero, lineup, setterZone, system };
    const { formationKey, actingSetter, slots } = getServeAlignment(teamState, phase);
    const outcome = {
      formationKey,
      actingSetter,
      liberoSlot: getLiberoSlot(teamState, phase),
      slots,
    };

    expect(outcome).toStrictEqual(expected);
    // Key order is part of the contract with the C# port.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(expected));
  });

  test("has exactly the expected cases", () => {
    expect(CASES.map(({ id }) => id)).toStrictEqual(EXPECTED_IDS);
  });
});
