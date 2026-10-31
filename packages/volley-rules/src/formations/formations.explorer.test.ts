import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { expect, test } from "vitest";

import { FORMATION_CATALOG, getFormation } from "./get-formation.js";
import type { FormationPhase, FormationSystem, RotationKey, RotationSlot } from "./types.js";

const EXPLORER_URL = new URL("../../../../docs/dominio/rotacoes-explorador.html", import.meta.url);
const GOLDEN_RELATIVE_PATH = "../../golden/formations.json";
const GOLDEN_URL = new URL(GOLDEN_RELATIVE_PATH, import.meta.url);

const START_ANCHOR = "const BASE=";
const END_ANCHOR = "function checks(";
const FORMATION_COUNT = 13;
const PHASES = [
  ["rec", "receiving"],
  ["srv", "serving"],
] as const;

type ExplorerPosition = readonly [role: string, x: number, y: number];

interface ExplorerFormationData {
  readonly rec: Readonly<Record<string, ExplorerPosition>>;
  readonly lib?: string;
  readonly serveSub?: Readonly<Record<string, string>>;
  readonly note: string;
}

interface ExplorerSystem {
  readonly label: string;
  readonly rots: readonly number[];
  get(rotation: number): ExplorerFormationData;
}

interface Explorer {
  readonly BASE: Readonly<Record<string, readonly [x: number, y: number]>>;
  readonly SYS: Readonly<Record<string, ExplorerSystem>>;
  readonly st: { sys: string; rot: number; ph: string };
  formation(): { readonly pos: Readonly<Record<string, ExplorerPosition>> };
}

interface GoldenSlot {
  readonly role: string;
  readonly x: number;
  readonly y: number;
}

interface GoldenCase {
  readonly system: string;
  readonly rotation: number;
  readonly phase: FormationPhase;
  readonly slots: Readonly<Record<string, GoldenSlot>>;
  readonly liberoReplaces: string | null;
}

function loadExplorer(): Explorer {
  const html = readFileSync(EXPLORER_URL, "utf8");
  const start = html.indexOf(START_ANCHOR);
  const end = html.indexOf(END_ANCHOR);
  if (start < 0 || end < start) {
    throw new Error(`Explorer anchors not found: "${START_ANCHOR}" and "${END_ANCHOR}".`);
  }
  const script = `${html.slice(start, end)};({BASE,SYS,st,formation})`;
  return runInNewContext(script) as Explorer;
}

/** Objects from the VM belong to another realm, which `toStrictEqual` would tell apart. */
function toPlainData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mapValues<V, R>(
  record: Readonly<Record<string, V>>,
  map: (value: V) => R,
): Record<string, R> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value)]));
}

const explorer = loadExplorer();

const toReceivePosition = ([role, x, y]: ExplorerPosition): GoldenSlot => ({ role, x, y });

function explorerCatalog(): unknown {
  return toPlainData({
    basePositions: mapValues(explorer.BASE, ([x, y]) => ({ x, y })),
    systems: mapValues(explorer.SYS, (system) => ({
      label: system.label,
      rotationOrder: system.rots,
      rotations: Object.fromEntries(
        system.rots.map((rotation) => {
          const data = system.get(rotation);
          return [
            rotation,
            {
              receive: mapValues(data.rec, toReceivePosition),
              liberoReplaces: data.lib ?? null,
              serveSubstitution: data.serveSub ?? null,
              note: data.note,
            },
          ];
        }),
      ),
    })),
  });
}

function explorerCases(): readonly GoldenCase[] {
  return Object.entries(explorer.SYS).flatMap(([system, definition]) =>
    definition.rots.flatMap((rotation) =>
      PHASES.map(([explorerPhase, phase]) => {
        explorer.st.sys = system;
        explorer.st.rot = rotation;
        explorer.st.ph = explorerPhase;
        return toPlainData({
          system,
          rotation,
          phase,
          slots: mapValues(explorer.formation().pos, toReceivePosition),
          liberoReplaces: definition.get(rotation).lib ?? null,
        });
      }),
    ),
  );
}

function catalogCases(): readonly GoldenCase[] {
  const systems = Object.entries(FORMATION_CATALOG.systems) as [
    FormationSystem,
    { readonly rotationOrder: readonly RotationKey[] },
  ][];
  return systems.flatMap(([system, { rotationOrder }]) =>
    rotationOrder.flatMap((rotation) =>
      PHASES.map(([, phase]) => {
        const formation = getFormation(system, rotation, phase);
        if (formation === undefined) {
          throw new Error(`Missing formation ${system} ${String(rotation)} ${phase}.`);
        }
        return toPlainData({
          system,
          rotation,
          phase,
          slots: mapValues(formation.slots, ({ role, point }) => ({ role, ...point })),
          liberoReplaces: formation.liberoReplaces,
        });
      }),
    ),
  );
}

function roleInCase(
  cases: readonly GoldenCase[],
  system: string,
  rotation: number,
  slot: RotationSlot,
): string | undefined {
  return cases.find(
    (entry) => entry.system === system && entry.rotation === rotation && entry.phase === "serving",
  )?.slots[String(slot)]?.role;
}

test("the explorer exposes the 13 formations", () => {
  const count = Object.values(explorer.SYS).reduce((sum, system) => sum + system.rots.length, 0);

  expect(count).toBe(FORMATION_COUNT);
});

test("the catalog is identical to the explorer", () => {
  expect(toPlainData(FORMATION_CATALOG)).toStrictEqual(explorerCatalog());
});

test("getFormation matches the explorer in all 26 cases", () => {
  const expected = explorerCases();

  expect(expected).toHaveLength(FORMATION_COUNT * PHASES.length);
  expect(catalogCases()).toStrictEqual(expected);
});

test("the golden file is generated from the explorer", async () => {
  const serialized = `${JSON.stringify(explorerCases(), null, 2)}\n`;

  await expect(serialized).toMatchFileSnapshot(GOLDEN_RELATIVE_PATH);
});

test("getFormation matches the golden file", () => {
  const golden = JSON.parse(readFileSync(fileURLToPath(GOLDEN_URL), "utf8")) as GoldenCase[];

  expect(catalogCases()).toStrictEqual(golden);
});

test("the golden file records who serves instead of the libero", () => {
  const golden = JSON.parse(readFileSync(fileURLToPath(GOLDEN_URL), "utf8")) as GoldenCase[];

  expect(roleInCase(golden, "5x1", 2, 1)).toBe("MB2");
  expect(roleInCase(golden, "5x1", 5, 1)).toBe("MB1");
  expect(roleInCase(golden, "6x2", 5, 1)).toBe("MB1");
});
