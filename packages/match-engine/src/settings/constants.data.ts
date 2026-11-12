import type { SettingsPath } from "./types.js";

/** The only version of the settings document and of its layers (ADR 0041). */
export const SETTINGS_SCHEMA_VERSION = 1;

export const SETTINGS_SCHEMA_VERSION_KEY = "schemaVersion";

/** The levels, from the least to the most specific: the most specific wins in each leaf. */
export const SETTINGS_LEVELS = ["group", "round", "match"] as const;

/** The levels a layer can have: the group is always a complete document. */
export const SETTINGS_LAYER_LEVELS = ["round", "match"] as const;

export const SETTINGS_VALUE_TYPES = ["boolean", "integer", "choice", "time", "text"] as const;

/** Keys of the ready-made templates, in the order of screen 04. Names in pt-BR live in the app. */
export const SETTINGS_TEMPLATE_KEYS = [
  "pelada",
  "racha-organizado",
  "treino",
  "areia-rei-da-quadra",
  "do-zero",
] as const;

/** The template a group gets when nothing else is chosen. */
export const DEFAULT_SETTINGS_TEMPLATE_KEY = "do-zero";

/** Screen 05: indoor court or beach, by number of players a side. */
export const SETTINGS_MODALITIES = ["indoor-6x6", "beach-4x4", "beach-2x2"] as const;

/** The closed list of refusals: the API answers all of them as `groups.settings-invalid`. */
export const SETTINGS_ERROR_CODES = [
  "settings.unknown-field",
  "settings.missing-field",
  "settings.wrong-type",
  "settings.out-of-range",
  "settings.unknown-value",
  "settings.invalid-text",
  "settings.not-allowed-at-level",
  "settings.unsupported-version",
] as const;

/** Reported for the root of the document, which has no path of its own. */
export const SETTINGS_ROOT_PATH = "";

export const PATH_SEPARATOR = ".";

/** Letters or symbols by category that render as blank space, as in `GroupName` of the C#. */
export const BLANK_FILLER_CODE_POINTS: readonly number[] = [0x115f, 0x1160, 0x3164, 0xffa0, 0x2800];

/** Every leaf, in the order of the catalog: the catalog must list exactly these. */
export const SETTINGS_PATHS = [
  "attendance.enabled",
  "attendance.capacityLimited",
  "attendance.capacity",
  "attendance.waitlistEnabled",
  "attendance.regularsEnabled",
  "attendance.dropInWindowEnabled",
  "attendance.dropInOpensHoursBefore",
  "schedule.enabled",
  "schedule.weekday",
  "schedule.startTime",
  "schedule.venue",
  "format.modality",
  "scoring.enabled",
  "scoring.bestOf",
  "scoring.pointsPerSet",
  "scoring.tieBreakEnabled",
  "scoring.tieBreakPoints",
  "scoring.winMargin",
  "queue.enabled",
  "queue.exitCriterion",
  "queue.exitMode",
  "queue.fixedExitCount",
  "queue.winnerExitEnabled",
  "queue.winnerExitWins",
  "rotation.enabled",
  "rotation.system",
  "rotation.ruleMode",
  "rotation.liberoEnabled",
  "draw.enabled",
  "draw.balanceByLevel",
  "mvp.enabled",
  "mvp.byStats",
  "mvp.voting",
  "mvp.individualPoints",
  "money.enabled",
  "money.dropInFeeCents",
  "money.monthlyFeeCents",
] as const satisfies readonly SettingsPath[];
