import { SETTINGS_SCHEMA_VERSION } from "./constants.data.js";
import { SETTINGS_BLOCKS, SETTINGS_CATALOG } from "./settings-catalog.js";
import type { GroupSettings, SettingsLayer, SettingsPath, SettingsValue } from "./types.js";

/** The leaves by path: the shape the merge, the normalization and the templates work on. */
export type FlatSettings = Readonly<Partial<Record<SettingsPath, SettingsValue>>>;

type UnknownRecord = Readonly<Record<string, unknown>>;

export function isRecord(raw: unknown): raw is UnknownRecord {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

/** Own keys only: `constructor` or `__proto__` never read through the prototype. */
export function ownValue(record: UnknownRecord, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function leafOf(tree: UnknownRecord, block: string, leaf: string): SettingsValue | undefined {
  const rawBlock = ownValue(tree, block);
  const value = isRecord(rawBlock) ? ownValue(rawBlock, leaf) : undefined;
  return value === null ? undefined : (value as SettingsValue | undefined);
}

/** Only for documents and layers the parsers made: a raw value goes through them first. */
export function flattenSettings(tree: GroupSettings | SettingsLayer): FlatSettings {
  const entries = SETTINGS_CATALOG.fields
    .map((field) => [field.path, leafOf(tree, field.block, field.leaf)] as const)
    .filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
}

/** Blocks without a leaf are left out, so an empty layer is `{ schemaVersion: 1 }`. */
export function nestSettings(flat: FlatSettings): UnknownRecord {
  const blocks = SETTINGS_BLOCKS.map((block) => {
    const leaves = SETTINGS_CATALOG.fields
      .filter((field) => field.block === block && flat[field.path] !== undefined)
      .map((field) => [field.leaf, flat[field.path]] as const);
    return [block, Object.fromEntries(leaves)] as const;
  }).filter(([, leaves]) => Object.keys(leaves).length > 0);
  return { schemaVersion: SETTINGS_SCHEMA_VERSION, ...Object.fromEntries(blocks) };
}

/** The caller guarantees every leaf is there and valid. */
export function toGroupSettings(flat: FlatSettings): GroupSettings {
  return nestSettings(flat) as GroupSettings;
}

export function toSettingsLayer(flat: FlatSettings): SettingsLayer {
  return nestSettings(flat) as SettingsLayer;
}
