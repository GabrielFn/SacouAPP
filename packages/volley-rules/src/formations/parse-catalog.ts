import {
  FORMATION_SYSTEMS,
  PLAYER_ROLES,
  ROTATION_KEYS,
  ROTATION_SLOTS,
} from "./constants.data.js";
import { deepFreeze } from "./deep-freeze.js";
import type {
  CourtPoint,
  FormationCatalog,
  FormationSystemTemplate,
  FormationTemplate,
  PlayerRole,
  ReceivePosition,
  RotationKey,
} from "./types.js";

type UnknownRecord = Readonly<Record<string, unknown>>;
type Reader<T> = (raw: unknown, path: string) => T;

const BASE_POSITION_LENGTH = 2;

function fail(path: string, expected: string): never {
  throw new Error(`Invalid formation catalog at "${path}": expected ${expected}.`);
}

function readObject(raw: unknown, path: string): UnknownRecord {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fail(path, "an object");
  }
  return raw as UnknownRecord;
}

function readArray(raw: unknown, path: string): readonly unknown[] {
  return Array.isArray(raw) ? raw : fail(path, "an array");
}

function readNumber(raw: unknown, path: string): number {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fail(path, "a number");
}

function readString(raw: unknown, path: string): string {
  return typeof raw === "string" ? raw : fail(path, "a string");
}

function readMember<T extends string | number>(
  allowed: readonly T[],
  raw: unknown,
  path: string,
): T {
  const match = allowed.find((value) => value === raw);
  return match ?? fail(path, `one of ${allowed.join(", ")}`);
}

function readNullable<T>(read: Reader<T>): Reader<T | null> {
  return (raw, path) => (raw === null ? null : read(raw, path));
}

function readEntries<K extends string | number, V>(
  raw: unknown,
  path: string,
  allowed: readonly K[],
  read: Reader<V>,
): Readonly<Partial<Record<K, V>>> {
  const record = readObject(raw, path);
  const unknownKey = Object.keys(record).find((key) => !allowed.some((k) => String(k) === key));
  if (unknownKey !== undefined) {
    return fail(`${path}.${unknownKey}`, `a key among ${allowed.join(", ")}`);
  }
  const entries = allowed
    .filter((key) => record[String(key)] !== undefined)
    .map((key) => [key, read(record[String(key)], `${path}.${String(key)}`)] as const);
  return Object.fromEntries(entries) as Partial<Record<K, V>>;
}

function readCompleteEntries<K extends string | number, V>(
  raw: unknown,
  path: string,
  keys: readonly K[],
  read: Reader<V>,
): Readonly<Record<K, V>> {
  const entries = readEntries(raw, path, keys, read);
  const missingKey = keys.find((key) => entries[key] === undefined);
  if (missingKey !== undefined) {
    return fail(`${path}.${String(missingKey)}`, "a value");
  }
  return entries as Record<K, V>;
}

const readRole: Reader<PlayerRole> = (raw, path) => readMember(PLAYER_ROLES, raw, path);

function readBasePosition(raw: unknown, path: string): CourtPoint {
  const items = readArray(raw, path);
  if (items.length !== BASE_POSITION_LENGTH) {
    return fail(path, "an [x, y] pair");
  }
  const [x, y] = items;
  return { x: readNumber(x, `${path}.x`), y: readNumber(y, `${path}.y`) };
}

function readReceivePosition(raw: unknown, path: string): ReceivePosition {
  const record = readObject(raw, path);
  return {
    role: readRole(record.role, `${path}.role`),
    x: readNumber(record.x, `${path}.x`),
    y: readNumber(record.y, `${path}.y`),
  };
}

function readServeSubstitution(raw: unknown, path: string): FormationTemplate["serveSubstitution"] {
  return readEntries(raw, path, ROTATION_SLOTS, readRole);
}

function readTemplate(raw: unknown, path: string): FormationTemplate {
  const record = readObject(raw, path);
  return {
    receive: readCompleteEntries(
      record.receive,
      `${path}.receive`,
      ROTATION_SLOTS,
      readReceivePosition,
    ),
    liberoReplaces: readNullable(readRole)(record.liberoReplaces, `${path}.liberoReplaces`),
    serveSubstitution: readNullable(readServeSubstitution)(
      record.serveSubstitution,
      `${path}.serveSubstitution`,
    ),
    note: readString(record.note, `${path}.note`),
  };
}

function readRotationOrder(
  raw: unknown,
  path: string,
  rotations: FormationSystemTemplate["rotations"],
): readonly RotationKey[] {
  const order = readArray(raw, path).map((key, index) =>
    readMember(ROTATION_KEYS, key, `${path}.${String(index)}`),
  );
  const keys = ROTATION_KEYS.filter((key) => rotations[key] !== undefined);
  const matchesRotations = order.length === keys.length && keys.every((k) => order.includes(k));
  return matchesRotations ? order : fail(path, `exactly the rotations ${keys.join(", ")}`);
}

function readSystem(raw: unknown, path: string): FormationSystemTemplate {
  const record = readObject(raw, path);
  const rotations = readEntries(record.rotations, `${path}.rotations`, ROTATION_KEYS, readTemplate);
  return {
    label: readString(record.label, `${path}.label`),
    rotationOrder: readRotationOrder(record.rotationOrder, `${path}.rotationOrder`, rotations),
    rotations,
  };
}

/**
 * Reads the embedded catalog. A corrupt catalog is a programming error rather than a business
 * rule, so it throws while loading, naming the offending field.
 */
export function parseFormationCatalog(raw: unknown): FormationCatalog {
  const root = readObject(raw, "root");
  const coordinateSystem = readObject(root.coordinateSystem, "coordinateSystem");
  // Not part of the catalog, but a role without a description means the data drifted.
  readCompleteEntries(root.roles, "roles", PLAYER_ROLES, readString);

  return deepFreeze({
    basePositions: readCompleteEntries(
      coordinateSystem.basePositions,
      "coordinateSystem.basePositions",
      ROTATION_SLOTS,
      readBasePosition,
    ),
    systems: readCompleteEntries(root.systems, "systems", FORMATION_SYSTEMS, readSystem),
  });
}
