import { deepFreeze } from "@sacou/volley-rules";

import { SETTINGS_CATALOG } from "./settings-catalog.js";
import { flattenSettings, toGroupSettings, type FlatSettings } from "./settings-tree.js";
import type {
  GroupSettings,
  ResolvedSettings,
  SettingsLayer,
  SettingsPath,
  SettingsSource,
  SettingsValue,
} from "./types.js";

interface Candidate {
  readonly source: SettingsSource;
  readonly leaves: FlatSettings;
}

interface Winner {
  readonly path: SettingsPath;
  readonly source: SettingsSource;
  readonly value: SettingsValue;
}

/** The group is a complete document, so it always has the last word when no layer has a value. */
function winnerFor(path: SettingsPath, layers: readonly Candidate[], group: FlatSettings): Winner {
  const layer = layers.find((candidate) => candidate.leaves[path] !== undefined);
  return layer === undefined
    ? { path, source: "group", value: group[path] as SettingsValue }
    : { path, source: layer.source, value: layer.leaves[path] as SettingsValue };
}

/**
 * Merges leaf by leaf: the most specific level wins in each leaf, never a whole block. Never fails
 * with parsed inputs; conflicts between leaves (the libero on, a system without one) are resolved
 * by `deriveMatchRules`, not here.
 */
export function resolveSettings(
  group: GroupSettings,
  round?: SettingsLayer,
  match?: SettingsLayer,
): ResolvedSettings {
  const layers: readonly Candidate[] = [
    { source: "match", leaves: match === undefined ? {} : flattenSettings(match) },
    { source: "round", leaves: round === undefined ? {} : flattenSettings(round) },
  ];
  const groupLeaves = flattenSettings(group);
  const winners = SETTINGS_CATALOG.fields.map((field) =>
    winnerFor(field.path, layers, groupLeaves),
  );
  const values = Object.fromEntries(winners.map((winner) => [winner.path, winner.value]));
  const sources = Object.fromEntries(winners.map((winner) => [winner.path, winner.source]));
  return deepFreeze({
    values: toGroupSettings(values as FlatSettings),
    sources: sources as ResolvedSettings["sources"],
  });
}
