import { deepFreeze } from "@sacou/volley-rules";

import { parseSettingsCatalog } from "./parse-catalog.js";
import rawCatalog from "./settings-catalog.json" with { type: "json" };
import type {
  SettingsBlock,
  SettingsCatalog,
  SettingsTemplate,
  SettingsTemplateKey,
} from "./types.js";

/** The single source of the settings, read by the C# too (ADR 0041). A broken file fails on load. */
export const SETTINGS_CATALOG: SettingsCatalog = deepFreeze(parseSettingsCatalog(rawCatalog));

/** The blocks, in the order of the catalog. */
export const SETTINGS_BLOCKS: readonly SettingsBlock[] = Object.freeze([
  ...new Set(SETTINGS_CATALOG.fields.map((field) => field.block)),
]);

export function getSettingsTemplate(key: SettingsTemplateKey): SettingsTemplate {
  const template = SETTINGS_CATALOG.templates.find((candidate) => candidate.key === key);
  if (template === undefined) {
    throw new Error(`Unknown settings template "${key}".`);
  }
  return template;
}
