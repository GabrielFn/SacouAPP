import { describe, expect, test } from "vitest";

import rawCatalog from "./formations.json" with { type: "json" };
import { parseFormationCatalog } from "./parse-catalog.js";

type Node = Record<string, unknown>;

const REMOVED = Symbol("removed");

const parentPath = (field: string): readonly string[] => field.split(".").slice(0, -1);
const lastKey = (field: string): string => field.split(".").at(-1) ?? field;

/** Clones the catalog and changes the value at a dotted path. Keys with dots are not used. */
function corrupted(field: string, value: unknown): unknown {
  const catalog: Node = structuredClone(rawCatalog);
  const parent = parentPath(field).reduce((node, key) => node[key] as Node, catalog);
  if (value === REMOVED) {
    Reflect.deleteProperty(parent, lastKey(field));
  } else {
    parent[lastKey(field)] = value;
  }
  return catalog;
}

describe("parseFormationCatalog", () => {
  test("accepts the embedded catalog", () => {
    expect(parseFormationCatalog(rawCatalog).systems["5x1"].rotationOrder).toHaveLength(6);
  });

  test("does not freeze its input", () => {
    const input = structuredClone(rawCatalog);

    parseFormationCatalog(input);

    expect(Object.isFrozen(input)).toBe(false);
  });

  test.each<[string, string, unknown]>([
    ["an unknown role", "systems.5x1.rotations.1.receive.1.role", "COACH"],
    ["a missing slot", "systems.5x1.rotations.1.receive.2", REMOVED],
    ["a slot that does not exist", "systems.4x2.rotations.3.receive.7", { role: "S1", x: 0, y: 0 }],
    ["a coordinate written as text", "systems.6x2.rotations.5.receive.3.x", "0.2"],
    ["a role without a description", "roles.P6", REMOVED],
    ["a malformed base position", "coordinateSystem.basePositions.1", [0.8]],
    ["an unknown system", "systems.3x3", {}],
    ["a missing system", "systems.livre", REMOVED],
    ["a rotation order missing a rotation", "systems.5x1.rotationOrder", [1, 6, 5]],
    ["a rotation order with a foreign rotation", "systems.6x2.rotationOrder", [1, 6, 4]],
    ["a rotation order with a repeated rotation", "systems.6x2.rotationOrder", [1, 6, 6]],
  ])("rejects %s, citing the field", (_name, field, value) => {
    expect(() => parseFormationCatalog(corrupted(field, value))).toThrow(`"${field}"`);
  });

  test("rejects an unknown serve substitution role, citing the field", () => {
    const field = "systems.5x1.rotations.2.serveSubstitution";

    expect(() => parseFormationCatalog(corrupted(field, { "1": "COACH" }))).toThrow(`"${field}.1"`);
  });
});
