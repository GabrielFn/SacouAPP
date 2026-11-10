import type { FormationSystem, OverlapRuleMode } from "@sacou/volley-rules";

import type { QueueExitCriterionKey } from "../queue/types.js";
import type { BestOf, ScoringRules, WinMargin } from "../score/types.js";
import type {
  SETTINGS_ERROR_CODES,
  SETTINGS_LAYER_LEVELS,
  SETTINGS_LEVELS,
  SETTINGS_MODALITIES,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_TEMPLATE_KEYS,
  SETTINGS_VALUE_TYPES,
} from "./constants.data.js";

export type SettingsLevel = (typeof SETTINGS_LEVELS)[number];
export type SettingsLayerLevel = (typeof SETTINGS_LAYER_LEVELS)[number];
/** Where a resolved leaf came from: the grey "do grupo" and the orange dot "nesta rodada". */
export type SettingsSource = SettingsLevel;
export type SettingsValueType = (typeof SETTINGS_VALUE_TYPES)[number];
export type SettingsTemplateKey = (typeof SETTINGS_TEMPLATE_KEYS)[number];
export type SettingsModality = (typeof SETTINGS_MODALITIES)[number];
export type SettingsErrorCode = (typeof SETTINGS_ERROR_CODES)[number];
export type SettingsSchemaVersion = typeof SETTINGS_SCHEMA_VERSION;

/** A leaf is never null: where "off" is a value, a boolean leaf sits beside it (ADR 0041). */
export type SettingsValue = boolean | number | string;

/** Type aliases, not interfaces, so a block reads as a record of leaves. */
export type AttendanceSettings = {
  readonly enabled: boolean;
  readonly capacityLimited: boolean;
  readonly capacity: number;
  readonly waitlistEnabled: boolean;
  readonly regularsEnabled: boolean;
  readonly dropInWindowEnabled: boolean;
  readonly dropInOpensHoursBefore: number;
};

export type ScheduleSettings = {
  readonly enabled: boolean;
  /** ISO, 1 is Monday. */
  readonly weekday: number;
  /** Local time, `HH:mm`. */
  readonly startTime: string;
  /** Free text that may name a person: never logged. */
  readonly venue: string;
};

export type FormatSettings = { readonly modality: SettingsModality };

export type ScoringSettings = {
  readonly enabled: boolean;
  readonly bestOf: BestOf;
  readonly pointsPerSet: number;
  readonly tieBreakEnabled: boolean;
  readonly tieBreakPoints: number;
  readonly winMargin: WinMargin;
};

export type QueueSettings = {
  readonly enabled: boolean;
  readonly exitCriterion: QueueExitCriterionKey;
};

export type RotationSettings = {
  readonly enabled: boolean;
  readonly system: FormationSystem;
  readonly ruleMode: OverlapRuleMode;
  readonly liberoEnabled: boolean;
};

export type DrawSettings = { readonly enabled: boolean; readonly balanceByLevel: boolean };

export type MvpSettings = {
  readonly enabled: boolean;
  readonly byStats: boolean;
  readonly voting: boolean;
  readonly individualPoints: boolean;
};

export type MoneySettings = {
  readonly enabled: boolean;
  readonly dropInFeeCents: number;
  readonly monthlyFeeCents: number;
};

export type SettingsBlocks = {
  readonly attendance: AttendanceSettings;
  readonly schedule: ScheduleSettings;
  readonly format: FormatSettings;
  readonly scoring: ScoringSettings;
  readonly queue: QueueSettings;
  readonly rotation: RotationSettings;
  readonly draw: DrawSettings;
  readonly mvp: MvpSettings;
  readonly money: MoneySettings;
};

export type SettingsBlock = keyof SettingsBlocks;

export type SettingsPath = {
  [B in SettingsBlock]: `${B}.${keyof SettingsBlocks[B] & string}`;
}[SettingsBlock];

/** The complete document of a group: every leaf has a value. */
export type GroupSettings = SettingsBlocks & { readonly schemaVersion: SettingsSchemaVersion };

/** A partial document of a round or a match: an absent leaf inherits. */
export type SettingsLayer = {
  readonly [B in SettingsBlock]?: Readonly<Partial<SettingsBlocks[B]>>;
} & { readonly schemaVersion: SettingsSchemaVersion };

export interface ResolvedSettings {
  readonly values: GroupSettings;
  readonly sources: Readonly<Record<SettingsPath, SettingsSource>>;
}

export interface SettingsError {
  readonly code: SettingsErrorCode;
  /** The leaf or block, by catalog path; the parent for an unknown key, `""` for the root. */
  readonly path: string;
}

export interface SettingsField {
  readonly path: SettingsPath;
  readonly block: SettingsBlock;
  readonly leaf: string;
  readonly type: SettingsValueType;
  readonly defaultValue: SettingsValue;
  /** Only for `integer`. */
  readonly min: number | null;
  readonly max: number | null;
  /** Only for `choice`. */
  readonly values: readonly SettingsValue[];
  /** Only for `text`: visible characters. */
  readonly maxLength: number | null;
  readonly levels: readonly SettingsLevel[];
  /** A fact of the group (day, time, venue, capacity, money): a template never brings nor clears it. */
  readonly groupFact: boolean;
  readonly pro: boolean;
  /** Only for `choice`: the values that are Pro when the field is not. */
  readonly proValues: readonly SettingsValue[];
}

/** A copy, never a link: applying it copies the values; absent non-fact leaves take "Do zero". */
export interface SettingsTemplate {
  readonly key: SettingsTemplateKey;
  readonly pro: boolean;
  readonly values: Readonly<Partial<Record<SettingsPath, SettingsValue>>>;
}

export interface SettingsCatalog {
  readonly schemaVersion: SettingsSchemaVersion;
  readonly fields: readonly SettingsField[];
  readonly templates: readonly SettingsTemplate[];
}

/** What a match freezes in `MatchStarted`, derived from the resolved values. */
export interface MatchRules {
  readonly scoring: ScoringRules;
  readonly system: FormationSystem;
  readonly ruleMode: OverlapRuleMode;
  /** Only with the libero on and a system that plays with one (5x1, 6x2). */
  readonly liberoAllowed: boolean;
}
