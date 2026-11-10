import { flattenSettings, toSettingsLayer } from "./settings-tree.js";
import { deepFreeze } from "@sacou/volley-rules";
import type { GroupSettings, SettingsLayer } from "./types.js";

/**
 * Drops the leaves equal to what the layer would inherit, so "1 mudança" counts right and the orange
 * dot only shows on a real change. The parent of a round is the group; the parent of a match is the
 * group and the round already resolved.
 */
export function normalizeLayer(parent: GroupSettings, layer: SettingsLayer): SettingsLayer {
  const inherited = flattenSettings(parent);
  const entries = Object.entries(flattenSettings(layer)).filter(
    ([path, value]) => inherited[path as keyof typeof inherited] !== value,
  );
  return deepFreeze(toSettingsLayer(Object.fromEntries(entries)));
}

/** The number of leaves a layer changes: what the round screen shows as "N mudanças". */
export function countLayerChanges(layer: SettingsLayer): number {
  return Object.keys(flattenSettings(layer)).length;
}
