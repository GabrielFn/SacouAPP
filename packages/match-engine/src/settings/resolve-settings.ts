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

function winnerFor(path: SettingsPath, candidates: readonly Candidate[]) {
  const winner = candidates.find((candidate) => candidate.leaves[path] !== undefined);
  return winner === undefined
    ? null
    : { source: winner.source, value: winner.leaves[path] as SettingsValue };
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
  const candidates: readonly Candidate[] = [
    { source: "match", leaves: match === undefined ? {} : flattenSettings(match) },
    { source: "round", leaves: round === undefined ? {} : flattenSettings(round) },
    { source: "group", leaves: flattenSettings(group) },
  ];
  const winners = SETTINGS_CATALOG.fields.map((field) => {
    const winner = winnerFor(field.path, candidates);
    return { path: field.path, source: winner?.source ?? "group", value: winner?.value };
  });
  const values = Object.fromEntries(winners.map((winner) => [winner.path, winner.value]));
  const sources = Object.fromEntries(winners.map((winner) => [winner.path, winner.source]));
  return deepFreeze({
    values: toGroupSettings(values as FlatSettings),
    sources: sources as ResolvedSettings["sources"],
  });
}
