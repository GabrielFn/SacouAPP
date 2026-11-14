import {
  applyTemplate,
  defaultGroupSettings,
  getSettingsTemplate,
  SETTINGS_TEMPLATE_KEYS,
  type GroupSettings,
  type SettingsBlock,
  type SettingsPath,
  type SettingsTemplateKey,
} from "@sacou/match-engine";

import { withLeaf } from "./settings-patch";

/** The blocks of screen 04a, in the order of the canvas. There is no money in the pilot (ADR 0046). */
export const CUSTOM_BLOCKS = [
  "attendance",
  "scoring",
  "queue",
  "rotation",
  "draw",
  "mvp",
] as const satisfies readonly SettingsBlock[];

export type CustomBlock = (typeof CUSTOM_BLOCKS)[number];

const LIST_SEPARATOR = ",";
const FROM_SCRATCH: SettingsTemplateKey = "do-zero";

/** The templates of the radio group of screen 04: all but "Do zero", which is the link to screen 04a. */
export const READY_TEMPLATES: readonly SettingsTemplateKey[] = SETTINGS_TEMPLATE_KEYS.filter(
  (key) => key !== FROM_SCRATCH,
);

/** The switch leaf of a block: the one thing screen 04a turns on. */
export function enabledPath(block: CustomBlock): SettingsPath {
  return `${block}.enabled` as SettingsPath;
}

function isCustomBlock(value: string): value is CustomBlock {
  return CUSTOM_BLOCKS.some((block) => block === value);
}

/** The blocks as the route carries them, in the order of the screen: "attendance,queue". */
export function serializeCustomBlocks(blocks: readonly CustomBlock[]): string {
  return CUSTOM_BLOCKS.filter((block) => blocks.includes(block)).join(LIST_SEPARATOR);
}

/**
 * The blocks from the route. An empty text is an empty list; an unknown or repeated block makes the
 * whole text invalid (`null`), because a link built by hand should not half work.
 */
export function parseCustomBlocks(text: string): readonly CustomBlock[] | null {
  if (text === "") return [];
  const parts = text.split(LIST_SEPARATOR);
  const blocks = parts.filter(isCustomBlock);
  const valid = blocks.length === parts.length && new Set(blocks).size === blocks.length;
  return valid ? blocks : null;
}

/** "Do zero" with only the chosen blocks on: everything else keeps the catalog default (off). */
export function customBase(blocks: readonly CustomBlock[]): GroupSettings {
  const scratch = applyTemplate(defaultGroupSettings(), getSettingsTemplate(FROM_SCRATCH));
  return blocks.reduce((settings, block) => withLeaf(settings, enabledPath(block), true), scratch);
}

/** Where a new group starts: a ready template, or "Do zero" with the blocks chosen on screen 04a. */
export interface GroupOrigin {
  readonly templateKey: SettingsTemplateKey;
  /** Only read for "Do zero"; empty for a ready template. */
  readonly blocks: readonly CustomBlock[];
}

export function templateOrigin(templateKey: SettingsTemplateKey): GroupOrigin {
  return { templateKey, blocks: [] };
}

/** "Do zero" with the blocks chosen on screen 04a. */
export function scratchOrigin(blocks: readonly CustomBlock[]): GroupOrigin {
  return { templateKey: FROM_SCRATCH, blocks };
}

export function isFromScratch(origin: GroupOrigin): boolean {
  return origin.templateKey === FROM_SCRATCH;
}

/**
 * The origin from the two route parameters; `null` when they cannot make one, and the route goes back to
 * screen 04. "Do zero" needs the list of blocks (possibly empty); a ready template ignores it.
 */
export function originFromParams(
  template: string | undefined,
  blocks: string | undefined,
): GroupOrigin | null {
  const templateKey = SETTINGS_TEMPLATE_KEYS.find((key) => key === template);
  if (templateKey === undefined) return null;
  if (templateKey !== FROM_SCRATCH) return templateOrigin(templateKey);
  const parsed = blocks === undefined ? null : parseCustomBlocks(blocks);
  return parsed === null ? null : scratchOrigin(parsed);
}

/** The document the server creates from the template key alone: the base of the patch. */
export function serverBase(origin: GroupOrigin): GroupSettings {
  return applyTemplate(defaultGroupSettings(), getSettingsTemplate(origin.templateKey));
}

/** The document the person starts from: the server base, or "Do zero" with the blocks of 04a on. */
export function originBase(origin: GroupOrigin): GroupSettings {
  return isFromScratch(origin) ? customBase(origin.blocks) : serverBase(origin);
}
