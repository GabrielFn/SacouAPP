import { describe, expect, test } from "vitest";

import { FORMATION_SYSTEMS, ROTATION_SLOTS } from "./constants.data.js";
import { FORMATION_CATALOG, getFormation } from "./get-formation.js";
import type {
  Formation,
  FormationPhase,
  FormationSystem,
  PlayerRole,
  RotationKey,
  RotationSlot,
} from "./types.js";

const PHASES: readonly FormationPhase[] = ["receiving", "serving"];
const BACK_ROW: readonly RotationSlot[] = [5, 6, 1];
const LINEUPS = {
  "5x1": ["S", "OH1", "MB1", "OPP", "OH2", "MB2"],
  "6x2": ["S1", "OH1", "MB1", "S2", "OH2", "MB2"],
  "4x2": ["S1", "OH1", "MB1", "S2", "OH2", "MB2"],
} as const satisfies Partial<Record<FormationSystem, readonly PlayerRole[]>>;
const SERVER_DEPTH = 1.05;

function requireFormation(
  system: FormationSystem,
  rotation: RotationKey,
  phase: FormationPhase,
): Formation {
  const formation = getFormation(system, rotation, phase);
  if (formation === undefined) {
    throw new Error(`Missing formation ${system} ${String(rotation)} ${phase}.`);
  }
  return formation;
}

function allFormations(): readonly Formation[] {
  return FORMATION_SYSTEMS.flatMap((system) =>
    FORMATION_CATALOG.systems[system].rotationOrder.flatMap((rotation) =>
      PHASES.map((phase) => requireFormation(system, rotation, phase)),
    ),
  );
}

function liberoSlots(formation: Formation): readonly RotationSlot[] {
  return ROTATION_SLOTS.filter((slot) => formation.slots[slot].role === "L");
}

describe("rotating the base lineup", () => {
  test.each(Object.entries(LINEUPS) as [keyof typeof LINEUPS, readonly PlayerRole[]][])(
    "reproduces the roles of %s in every rotation",
    (system, lineup) => {
      FORMATION_CATALOG.systems[system].rotationOrder.forEach((rotation, turns) => {
        const formation = requireFormation(system, rotation, "receiving");
        const roles = ROTATION_SLOTS.map((slot) => {
          const role = formation.slots[slot].role;
          return role === "L" ? formation.liberoReplaces : role;
        });
        const rotated = ROTATION_SLOTS.map(
          (slot) => lineup[(slot - 1 + turns) % ROTATION_SLOTS.length],
        );

        expect(roles).toStrictEqual(rotated);
      });
    },
  );
});

describe("6x2", () => {
  test.each([1, 6, 5] as const)(
    "is the 5x1 with the setters renamed in rotation %i",
    (rotation) => {
      const renamed: Partial<Record<PlayerRole, PlayerRole>> = { S: "S1", OPP: "S2" };
      const fiveOne = requireFormation("5x1", rotation, "receiving");
      const sixTwo = requireFormation("6x2", rotation, "receiving");

      ROTATION_SLOTS.forEach((slot) => {
        const { role, point } = fiveOne.slots[slot];

        expect(sixTwo.slots[slot]).toStrictEqual({ role: renamed[role] ?? role, point });
      });
    },
  );
});

describe("libero", () => {
  const receiving = allFormations().filter(({ phase }) => phase === "receiving");

  test("appears exactly once in 5x1 and 6x2", () => {
    const withLibero = receiving.filter(({ system }) => system === "5x1" || system === "6x2");

    expect(withLibero).toHaveLength(9);
    withLibero.forEach((formation) => {
      expect(liberoSlots(formation)).toHaveLength(1);
    });
  });

  test("never appears in 4x2 and Livre", () => {
    receiving
      .filter(({ system }) => system === "4x2" || system === "livre")
      .forEach((formation) => {
        expect(liberoSlots(formation)).toHaveLength(0);
        expect(formation.liberoReplaces).toBeNull();
      });
  });

  test("stays in the back row", () => {
    receiving.flatMap(liberoSlots).forEach((slot) => {
      expect(BACK_ROW).toContain(slot);
    });
  });

  test("is in position 1 only when the replaced player serves in that place", () => {
    receiving.forEach((formation) => {
      const template = FORMATION_CATALOG.systems[formation.system].rotations[formation.rotation];
      const servesInstead =
        template?.serveSubstitution?.[1] !== undefined &&
        template.serveSubstitution[1] === formation.liberoReplaces;

      expect(liberoSlots(formation).includes(1)).toBe(servesInstead);
    });
  });

  test("never serves", () => {
    allFormations()
      .filter(({ phase }) => phase === "serving")
      .forEach((formation) => {
        expect(formation.slots[1].role).not.toBe("L");
      });
  });
});

describe("coordinates", () => {
  test("stay inside the half court while receiving", () => {
    allFormations()
      .filter(({ phase }) => phase === "receiving")
      .forEach((formation) => {
        ROTATION_SLOTS.forEach((slot) => {
          const { x, y } = formation.slots[slot].point;

          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(1);
        });
      });
  });

  test("only leave the court for the server", () => {
    allFormations()
      .filter(({ phase }) => phase === "serving")
      .forEach((formation) => {
        expect(formation.slots[1].point.y).toBe(SERVER_DEPTH);
        ROTATION_SLOTS.filter((slot) => slot !== 1).forEach((slot) => {
          expect(formation.slots[slot].point.y).toBeLessThanOrEqual(1);
        });
      });
  });
});

describe("rotations outside the system", () => {
  test.each([
    ["6x2", 2],
    ["6x2", 3],
    ["6x2", 4],
    ["4x2", 1],
    ["4x2", 5],
    ["4x2", 6],
    ["livre", 1],
    ["5x1", 0],
  ] as const)("%s has no rotation %i", (system, rotation) => {
    PHASES.forEach((phase) => {
      expect(getFormation(system, rotation, phase)).toBeUndefined();
    });
  });

  test("Livre has its single rotation in both phases", () => {
    PHASES.forEach((phase) => {
      expect(getFormation("livre", 0, phase)?.slots[3].role).toBe("P3");
    });
  });
});

describe("immutability", () => {
  test("a formation rejects writes", () => {
    const formation = requireFormation("5x1", 1, "serving");

    expect(() => {
      // @ts-expect-error Formation is read-only.
      formation.note = "changed";
    }).toThrow(TypeError);
    expect(() => {
      // @ts-expect-error Coordinates are read-only.
      formation.slots[1].point.x = 0;
    }).toThrow(TypeError);
  });

  test("the catalog rejects writes", () => {
    expect(() => {
      // @ts-expect-error The catalog is read-only.
      FORMATION_CATALOG.basePositions[1].x = 0;
    }).toThrow(TypeError);
    expect(() => {
      // @ts-expect-error The catalog is read-only.
      FORMATION_CATALOG.systems.livre.label = "changed";
    }).toThrow(TypeError);
  });
});
