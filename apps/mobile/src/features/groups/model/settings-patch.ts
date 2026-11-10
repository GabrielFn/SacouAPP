import {
  normalizeLayer,
  SETTINGS_SCHEMA_VERSION,
  type GroupSettings,
  type SettingsBlock,
  type SettingsLayer,
  type SettingsPath,
  type SettingsValue,
} from "@sacou/match-engine";

const PATH_SEPARATOR = ".";

type Leaves = Readonly<Record<string, SettingsValue>>;
type Blocks = Readonly<Record<string, Leaves>>;

function split(path: SettingsPath): readonly [SettingsBlock, string] {
  const [block = "", leaf = ""] = path.split(PATH_SEPARATOR);
  return [block as SettingsBlock, leaf];
}

export function leafOf(settings: GroupSettings, path: SettingsPath): SettingsValue | undefined {
  const [block, leaf] = split(path);
  return (settings as unknown as Blocks)[block]?.[leaf];
}

/** A copy of the document with one leaf changed. */
export function withLeaf(
  settings: GroupSettings,
  path: SettingsPath,
  value: SettingsValue,
): GroupSettings {
  const [block, leaf] = split(path);
  return { ...settings, [block]: { ...settings[block], [leaf]: value } };
}

/** The layer with only the leaves of `edited` that differ from `base` (ADR 0041). */
export function settingsPatch(base: GroupSettings, edited: GroupSettings): SettingsLayer {
  return normalizeLayer(base, edited);
}

/** The layer of one change: `{ schemaVersion, block: { leaf } }`. */
export function leafLayer(
  entries: readonly (readonly [SettingsPath, SettingsValue])[],
): SettingsLayer {
  const blocks = entries.reduce<Record<string, Leaves>>((layer, [path, value]) => {
    const [block, leaf] = split(path);
    return { ...layer, [block]: { ...layer[block], [leaf]: value } };
  }, {});
  return { schemaVersion: SETTINGS_SCHEMA_VERSION, ...blocks };
}
