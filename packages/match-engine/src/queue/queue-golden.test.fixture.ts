import { expect, test } from "vitest";

import type { CourtSessionState } from "../score/types.js";
import { planNextMatch } from "./plan-next-match.js";
import type { NextMatchInput } from "./types.js";

/** A case of `queue-plans.json` or `queue-modes.json`: the input as the screen may send it. */
export interface PlanCase {
  readonly id: string;
  readonly input: {
    readonly state: CourtSessionState;
    readonly criterion: string;
    readonly criterionInput: unknown;
    readonly playersPerTeam: number;
    readonly exitMode: unknown;
    readonly winnerExit: unknown;
    readonly winnerCriterionInput: unknown;
  };
  readonly expected: unknown;
}

function planCase({ input }: PlanCase) {
  const { state, ...choice } = input;
  // The file holds modes, criteria and inputs the type forbids, as the screen or a hostile caller may.
  const planned = planNextMatch(state, choice as NextMatchInput);
  return planned.ok ? { ok: true, ...planned.value } : { ok: false, ...planned.error };
}

/** Runs every case of the file, and checks the list of ids against the literal one. */
export function testPlanGolden(cases: readonly PlanCase[], expectedIds: readonly string[]): void {
  test.each(cases)("$id", (goldenCase) => {
    const outcome = planCase(goldenCase);

    expect(outcome).toStrictEqual(goldenCase.expected);
    // Key order is part of the contract with the C# port.
    expect(JSON.stringify(outcome)).toBe(JSON.stringify(goldenCase.expected));
  });

  test("has exactly the expected cases", () => {
    expect(cases.map(({ id }) => id)).toStrictEqual(expectedIds);
  });
}
