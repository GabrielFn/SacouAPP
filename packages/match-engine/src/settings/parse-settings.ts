import { deepFreeze, err, ok, type Result } from "@sacou/volley-rules";

import { readSettingsTree, type LeafReading } from "./parse-tree.js";
import { toGroupSettings } from "./settings-tree.js";
import type { GroupSettings, SettingsError, SettingsField } from "./types.js";
import { checkValue } from "./value-rules.js";

/** In a document, `null` is not "inherit": there is nothing above the group. */
function readDocumentLeaf(field: SettingsField, raw: unknown, present: boolean): LeafReading {
  if (!present) {
    return { kind: "error", code: "settings.missing-field" };
  }
  if (raw === null) {
    return { kind: "error", code: "settings.wrong-type" };
  }
  const code = checkValue(field, raw);
  return code === null ? { kind: "value", value: raw } : { kind: "error", code };
}

/**
 * The complete document of a group, read strictly: a missing or extra leaf, a wrong type, a value out
 * of its range or list, or another `schemaVersion` is refused. Reading from storage goes through here
 * too, never straight into the type (ADR 0041).
 */
export function parseGroupSettings(raw: unknown): Result<GroupSettings, SettingsError> {
  const flat = readSettingsTree(raw, { requiresBlocks: true, readLeaf: readDocumentLeaf });
  return flat.ok ? ok(deepFreeze(toGroupSettings(flat.value))) : err(flat.error);
}
