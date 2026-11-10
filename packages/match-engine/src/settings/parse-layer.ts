import { deepFreeze, err, ok, type Result } from "@sacou/volley-rules";

import { readSettingsTree, type LeafReading } from "./parse-tree.js";
import { toSettingsLayer } from "./settings-tree.js";
import type { SettingsError, SettingsField, SettingsLayer, SettingsLayerLevel } from "./types.js";
import { checkValue } from "./value-rules.js";

function layerLeafReader(level: SettingsLayerLevel) {
  return (field: SettingsField, raw: unknown, present: boolean): LeafReading => {
    if (!present || raw === null || raw === undefined) {
      return { kind: "absent" };
    }
    if (!field.levels.includes(level)) {
      return { kind: "error", code: "settings.not-allowed-at-level" };
    }
    const code = checkValue(field, raw);
    return code === null ? { kind: "value", value: raw } : { kind: "error", code };
  };
}

/**
 * A partial layer of a round or a match. An absent or `null` leaf (or block) inherits; a leaf the
 * level does not take is refused, as is anything the document parser refuses.
 */
export function parseLayer(
  level: SettingsLayerLevel,
  raw: unknown,
): Result<SettingsLayer, SettingsError> {
  const flat = readSettingsTree(raw, { requiresBlocks: false, readLeaf: layerLeafReader(level) });
  return flat.ok ? ok(deepFreeze(toSettingsLayer(flat.value))) : err(flat.error);
}
