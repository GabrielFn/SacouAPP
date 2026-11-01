import { readFileSync } from "node:fs";

import { describe, expect, expectTypeOf, test } from "vitest";

import {
  FORMATION_CATALOG,
  FORMATION_SYSTEMS,
  ROTATION_SLOTS,
  getFormation,
  type CourtPoint,
  type Formation,
  type FormationPhase,
  type RotationSlot,
} from "../formations/index.js";
import { err, ok, type Result } from "../result.js";
import {
  DEFAULT_OVERLAP_RULE_MODE,
  DEFAULT_OVERLAP_TOLERANCE,
  OVERLAP_RELATIONS,
  OVERLAP_RULE_MODES,
} from "./constants.data.js";
import { validateFormationOverlap, validateOverlap } from "./overlap-validator.js";
import type { OverlapCheck, OverlapError, OverlapRelationId, OverlapRuleMode } from "./types.js";

type Positions = Readonly<Record<RotationSlot, CourtPoint>>;

type GoldenExpected =
  | { readonly ok: true; readonly checked: readonly OverlapRelationId[] }
  | {
      readonly ok: false;
      readonly code: "overlap";
      readonly violations: readonly OverlapRelationId[];
    }
  | { readonly ok: false; readonly code: "invalid-tolerance" };

interface OverlapGoldenCase {
  readonly id: string;
  readonly mode: OverlapRuleMode;
  readonly phase: FormationPhase;
  readonly tolerance?: number;
  readonly slots: Positions;
  readonly expected: GoldenExpected;
}

interface FormationGoldenCase {
  readonly phase: FormationPhase;
  readonly slots: Positions;
}

const PHASES: readonly FormationPhase[] = ["receiving", "serving"];
const MODES_AND_PHASES = OVERLAP_RULE_MODES.flatMap((mode) =>
  PHASES.map((phase) => ({ mode, phase })),
);
const FORMATION_CASE_COUNT = 26;
const TOLERANCES = [{}, { tolerance: 0 }] as const;

const ALL_RELATIONS = [
  "1-behind-2",
  "6-behind-3",
  "5-behind-4",
  "4-left-of-3",
  "3-left-of-2",
  "5-left-of-6",
  "6-left-of-1",
] as const satisfies readonly OverlapRelationId[];
const WITHOUT_SERVER = [
  "6-behind-3",
  "5-behind-4",
  "4-left-of-3",
  "3-left-of-2",
  "5-left-of-6",
] as const satisfies readonly OverlapRelationId[];

const BASE: Positions = {
  1: { x: 0.75, y: 0.75 },
  2: { x: 0.75, y: 0.25 },
  3: { x: 0.5, y: 0.25 },
  4: { x: 0.25, y: 0.25 },
  5: { x: 0.25, y: 0.75 },
  6: { x: 0.5, y: 0.75 },
};

function readGolden(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../golden/${name}`, import.meta.url), "utf8"));
}

const overlapCases = readGolden("overlap.json") as readonly OverlapGoldenCase[];
const formationCases = readGolden("formations.json") as readonly FormationGoldenCase[];

function toResult(expected: GoldenExpected): Result<OverlapCheck, OverlapError> {
  if (expected.ok) {
    return ok({ checked: expected.checked });
  }
  return expected.code === "overlap"
    ? err({ code: expected.code, violations: expected.violations })
    : err({ code: expected.code });
}

/** What the slots break geometrically, ignoring the exemptions of the mode and phase of the case. */
function brokenRelations({ slots, tolerance }: OverlapGoldenCase): readonly OverlapRelationId[] {
  const result = validateOverlap(slots, {
    mode: "classic",
    phase: "receiving",
    ...(tolerance === undefined ? {} : { tolerance }),
  });
  return !result.ok && result.error.code === "overlap" ? result.error.violations : [];
}

function expectedChecked(
  mode: OverlapRuleMode,
  phase: FormationPhase,
): readonly OverlapRelationId[] {
  if (phase === "receiving") {
    return ALL_RELATIONS;
  }
  return mode === "classic" ? WITHOUT_SERVER : [];
}

function allFormations(): readonly Formation[] {
  return FORMATION_SYSTEMS.flatMap((system) =>
    FORMATION_CATALOG.systems[system].rotationOrder.flatMap((rotation) =>
      PHASES.flatMap((phase) => getFormation(system, rotation, phase) ?? []),
    ),
  );
}

describe("golden/overlap.json", () => {
  test.each(overlapCases.map((goldenCase) => [goldenCase.id, goldenCase] as const))(
    "%s",
    (_id, goldenCase) => {
      expect(validateOverlap(goldenCase.slots, goldenCase)).toStrictEqual(
        toResult(goldenCase.expected),
      );
    },
  );
});

describe("golden/overlap.json coverage", () => {
  test("case ids are unique", () => {
    const ids = overlapCases.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every case fills the six slots with numbers", () => {
    overlapCases.forEach(({ slots }) => {
      expect(Object.keys(slots)).toStrictEqual(ROTATION_SLOTS.map(String));
      ROTATION_SLOTS.forEach((slot) => {
        expect(slots[slot]).toStrictEqual({
          x: expect.any(Number) as number,
          y: expect.any(Number) as number,
        });
      });
    });
  });

  test.each(MODES_AND_PHASES)("$mode $phase has a passing case", ({ mode, phase }) => {
    const passing = overlapCases.filter(
      (goldenCase) =>
        goldenCase.mode === mode && goldenCase.phase === phase && goldenCase.expected.ok,
    );

    expect(passing).not.toHaveLength(0);
  });

  test.each(
    MODES_AND_PHASES.flatMap(({ mode, phase }) =>
      ALL_RELATIONS.map((relation) => ({ mode, phase, relation })),
    ),
  )("$mode $phase breaks $relation in some case", ({ mode, phase, relation }) => {
    const breaking = overlapCases.filter(
      (goldenCase) =>
        goldenCase.mode === mode &&
        goldenCase.phase === phase &&
        brokenRelations(goldenCase).includes(relation),
    );

    expect(breaking).not.toHaveLength(0);
  });
});

describe("ready-made formations", () => {
  test("the sources have every formation in both phases", () => {
    expect(formationCases).toHaveLength(FORMATION_CASE_COUNT);
    expect(allFormations()).toHaveLength(FORMATION_CASE_COUNT);
  });

  test.each(
    MODES_AND_PHASES.flatMap(({ mode, phase }) =>
      TOLERANCES.map((tolerance) => ({ mode, phase, tolerance })),
    ),
  )("golden/formations.json passes in $mode $phase with $tolerance", (options) => {
    const { mode, phase, tolerance } = options;
    const cases = formationCases.filter((goldenCase) => goldenCase.phase === phase);

    expect(cases).not.toHaveLength(0);
    cases.forEach(({ slots }) => {
      expect(validateOverlap(slots, { mode, phase, ...tolerance })).toStrictEqual(
        ok({ checked: expectedChecked(mode, phase) }),
      );
    });
  });

  test.each(
    OVERLAP_RULE_MODES.flatMap((mode) => TOLERANCES.map((tolerance) => ({ mode, tolerance }))),
  )("getFormation passes in $mode with $tolerance", ({ mode, tolerance }) => {
    allFormations().forEach((formation) => {
      expect(validateFormationOverlap(formation, { mode, ...tolerance })).toStrictEqual(
        ok({ checked: expectedChecked(mode, formation.phase) }),
      );
    });
  });
});

describe("validateFormationOverlap", () => {
  function withLiberoAtTheNet(phase: FormationPhase): Formation {
    const formation = getFormation("5x1", 1, phase);
    if (formation === undefined) {
      throw new Error("Missing formation 5x1 1.");
    }
    return {
      ...formation,
      slots: { ...formation.slots, 1: { role: "L", point: { x: 0.95, y: 0 } } },
    };
  }

  test("counts the libero in the place taken", () => {
    expect(
      validateFormationOverlap(withLiberoAtTheNet("receiving"), { mode: "classic" }),
    ).toStrictEqual(err({ code: "overlap", violations: ["1-behind-2"] }));
  });

  test("takes the phase from the formation", () => {
    expect(
      validateFormationOverlap(withLiberoAtTheNet("serving"), { mode: "classic" }),
    ).toStrictEqual(ok({ checked: WITHOUT_SERVER }));
  });

  test("rejects an invalid tolerance", () => {
    expect(
      validateFormationOverlap(withLiberoAtTheNet("serving"), {
        mode: "fivb-2025-28",
        tolerance: -1,
      }),
    ).toStrictEqual(err({ code: "invalid-tolerance" }));
  });
});

describe("values JSON cannot carry", () => {
  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "tolerance %d is invalid",
    (tolerance) => {
      expect(
        validateOverlap(BASE, { mode: "fivb-2025-28", phase: "receiving", tolerance }),
      ).toStrictEqual(err({ code: "invalid-tolerance" }));
    },
  );

  test("a NaN depth fails closed", () => {
    expect(
      validateOverlap(
        { ...BASE, 1: { x: 0.75, y: Number.NaN } },
        { mode: "fivb-2025-28", phase: "receiving" },
      ),
    ).toStrictEqual(err({ code: "overlap", violations: ["1-behind-2"] }));
  });

  test("a NaN lateral coordinate fails closed", () => {
    expect(
      validateOverlap(
        { ...BASE, 4: { x: Number.NaN, y: 0.25 } },
        { mode: "fivb-2025-28", phase: "receiving" },
      ),
    ).toStrictEqual(err({ code: "overlap", violations: ["4-left-of-3"] }));
  });
});

describe("overlap constants", () => {
  test("the default mode is FIVB 2025-28", () => {
    expect(DEFAULT_OVERLAP_RULE_MODE).toBe("fivb-2025-28");
    expect(OVERLAP_RULE_MODES).toContain(DEFAULT_OVERLAP_RULE_MODE);
  });

  test("the default tolerance is 0.02", () => {
    expect(DEFAULT_OVERLAP_TOLERANCE).toBe(0.02);
  });

  test("the relations keep the fixed order", () => {
    expect(OVERLAP_RELATIONS.map(({ id }) => id)).toStrictEqual(ALL_RELATIONS);
  });

  test("the relations reject mutation", () => {
    expect(() => {
      // @ts-expect-error The relations are read-only.
      OVERLAP_RELATIONS[0].back = 2;
    }).toThrow(TypeError);
    expect(() => (OVERLAP_RELATIONS as unknown as unknown[]).push("extra")).toThrow(TypeError);
  });

  test("the mode keeps its literal type", () => {
    expectTypeOf<OverlapRuleMode>().toEqualTypeOf<"fivb-2025-28" | "classic">();
  });
});
