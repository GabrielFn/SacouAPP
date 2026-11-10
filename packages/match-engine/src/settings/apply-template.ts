import { deepFreeze } from "@sacou/volley-rules";

import { SETTINGS_CATALOG } from "./settings-catalog.js";
import { flattenSettings, toGroupSettings } from "./settings-tree.js";
import type { GroupSettings, SettingsTemplate } from "./types.js";

/**
 * Copies a template onto a group: every leaf that is not a fact of the group takes the template's
 * value, or "Do zero" when the template leaves it out. The facts (day, time, venue, capacity,
 * money) stay: changing from "Racha" to "Treino" never clears the monthly fee.
 */
export function applyTemplate(current: GroupSettings, template: SettingsTemplate): GroupSettings {
  const leaves = flattenSettings(current);
  const entries = SETTINGS_CATALOG.fields.map((field) => {
    const value = field.groupFact
      ? leaves[field.path]
      : (template.values[field.path] ?? field.defaultValue);
    return [field.path, value] as const;
  });
  return deepFreeze(toGroupSettings(Object.fromEntries(entries)));
}

/** "Do zero" in every leaf: the base of a new group before its template. */
export function defaultGroupSettings(): GroupSettings {
  const entries = SETTINGS_CATALOG.fields.map((field) => [field.path, field.defaultValue] as const);
  return deepFreeze(toGroupSettings(Object.fromEntries(entries)));
}
