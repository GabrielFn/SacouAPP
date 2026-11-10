import { err, ok, type Result } from "@sacou/volley-rules";

import {
  SETTINGS_ROOT_PATH,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_SCHEMA_VERSION_KEY,
} from "./constants.data.js";
import { SETTINGS_BLOCKS, SETTINGS_CATALOG } from "./settings-catalog.js";
import { isRecord, ownValue, type FlatSettings } from "./settings-tree.js";
import type { SettingsBlock, SettingsError, SettingsErrorCode, SettingsField } from "./types.js";

/** What a parser does with one leaf: a value, nothing (it inherits) or a refusal. */
export type LeafReading =
  | { readonly kind: "value"; readonly value: unknown }
  | { readonly kind: "absent" }
  | { readonly kind: "error"; readonly code: SettingsErrorCode };

export interface TreePolicy {
  /** A document needs every block; a layer takes an absent or `null` block as empty. */
  readonly requiresBlocks: boolean;
  readonly readLeaf: (field: SettingsField, raw: unknown, present: boolean) => LeafReading;
}

type Entry =
  | { readonly kind: "value"; readonly field: SettingsField; readonly value: unknown }
  | { readonly kind: "error"; readonly error: SettingsError };

const ROOT_KEYS: readonly string[] = [SETTINGS_SCHEMA_VERSION_KEY, ...SETTINGS_BLOCKS];

function failure(code: SettingsErrorCode, path: string): Entry {
  return { kind: "error", error: { code, path } };
}

function checkRoot(raw: unknown): SettingsError | null {
  if (!isRecord(raw)) {
    return { code: "settings.wrong-type", path: SETTINGS_ROOT_PATH };
  }
  if (ownValue(raw, SETTINGS_SCHEMA_VERSION_KEY) !== SETTINGS_SCHEMA_VERSION) {
    return { code: "settings.unsupported-version", path: SETTINGS_SCHEMA_VERSION_KEY };
  }
  const hasUnknownKey = Object.keys(raw).some((key) => !ROOT_KEYS.includes(key));
  return hasUnknownKey ? { code: "settings.unknown-field", path: SETTINGS_ROOT_PATH } : null;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

type BlockReading = { readonly record: UnknownRecord } | { readonly entry: Entry };

function blockOf(raw: unknown, block: SettingsBlock, policy: TreePolicy): BlockReading {
  if (raw === undefined || raw === null) {
    const code = raw === null ? "settings.wrong-type" : "settings.missing-field";
    return policy.requiresBlocks ? { entry: failure(code, block) } : { record: {} };
  }
  return isRecord(raw) ? { record: raw } : { entry: failure("settings.wrong-type", block) };
}

function readBlock(
  root: UnknownRecord,
  block: SettingsBlock,
  policy: TreePolicy,
): readonly Entry[] {
  const fields = SETTINGS_CATALOG.fields.filter((field) => field.block === block);
  const reading = blockOf(ownValue(root, block), block, policy);
  if ("entry" in reading) {
    return [reading.entry];
  }
  const rawBlock = reading.record;
  const hasUnknownLeaf = Object.keys(rawBlock).some(
    (key) => !fields.some((field) => field.leaf === key),
  );
  if (hasUnknownLeaf) {
    return [failure("settings.unknown-field", block)];
  }
  return fields.flatMap((field): readonly Entry[] => {
    const present = Object.hasOwn(rawBlock, field.leaf);
    const leafReading = policy.readLeaf(field, ownValue(rawBlock, field.leaf), present);
    if (leafReading.kind === "error") {
      return [failure(leafReading.code, field.path)];
    }
    return leafReading.kind === "value" ? [{ kind: "value", field, value: leafReading.value }] : [];
  });
}

/**
 * Walks the catalog, not the input: blocks and leaves in catalog order, so the first refusal is the
 * same in TypeScript and C#, whatever the order of the keys received.
 */
export function readSettingsTree(
  raw: unknown,
  policy: TreePolicy,
): Result<FlatSettings, SettingsError> {
  const rootError = checkRoot(raw);
  if (rootError !== null || !isRecord(raw)) {
    return err(rootError ?? { code: "settings.wrong-type", path: SETTINGS_ROOT_PATH });
  }
  const entries = SETTINGS_BLOCKS.flatMap((block) => readBlock(raw, block, policy));
  const firstError = entries.find((entry) => entry.kind === "error");
  if (firstError !== undefined) {
    return err(firstError.error);
  }
  const values = entries.flatMap((entry) =>
    entry.kind === "value" ? [[entry.field.path, entry.value] as const] : [],
  );
  return ok(Object.fromEntries(values) as FlatSettings);
}
