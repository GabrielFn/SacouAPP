import {
  deriveMatchRules,
  parseGroupSettings,
  SETTINGS_CATALOG,
  type GroupSettings,
  type SettingsBlock,
  type SettingsField,
  type SettingsPath,
  type SettingsValue,
} from "@sacou/match-engine";

import type { GroupRole } from "../../../services/api/sacou-api";
import { settingsStrings } from "../../../strings/settings.pt-BR";
import { organizes } from "./groups-list.selectors";
import type { PendingLeaves, SettingsSheet } from "./group-settings-form.reducer";
import { parseBrlToCents } from "./money-text";
import { scheduleSummary } from "./schedule-text";
import { settingsErrorText } from "./settings-errors-text";
import { leafOf, withLeaf } from "./settings-patch";
import { normalizeText } from "./create-group.selectors";

const { summary, screen } = settingsStrings;
const SUMMARY_SEPARATOR = " · ";
const WHOLE_NUMBER = /^\d{1,9}$/;

export interface LeafChange {
  readonly path: SettingsPath;
  readonly value: SettingsValue;
}

/** Only admins and co-admins change the rules; the others read them (D4). */
export function canManageSettings(role: GroupRole): boolean {
  return organizes(role);
}

/** The server document with what the person changed on top, for the screen to show. */
export function visibleSettings(server: GroupSettings, pending: PendingLeaves): GroupSettings {
  return (Object.entries(pending) as [SettingsPath, SettingsValue][]).reduce(
    (settings, [path, value]) => withLeaf(settings, path, value),
    server,
  );
}

/** The refusal of the engine's parser, the rule of the server, as text; `null` when it passes. */
export function settingsError(edited: GroupSettings): string | null {
  const parsed = parseGroupSettings(edited);
  return parsed.ok ? null : settingsErrorText(parsed.error);
}

function fieldOf(path: SettingsPath): SettingsField | undefined {
  return SETTINGS_CATALOG.fields.find((field) => field.path === path);
}

/** What a field sheet holds as the leaf value; `null` when the text is not even the right kind. */
export function parseFieldText(path: SettingsPath, text: string): SettingsValue | null {
  const type = fieldOf(path)?.type;
  if (type === "text") return normalizeText(text);
  if (path.endsWith("Cents")) return parseBrlToCents(text);
  if (type === "integer") return WHOLE_NUMBER.test(text.trim()) ? Number(text.trim()) : null;
  return null;
}

/** The leaves a sheet would write when confirmed; `null` when the draft cannot be one. */
export function sheetChanges(sheet: SettingsSheet): readonly LeafChange[] | null {
  switch (sheet.kind) {
    case "field": {
      const value = parseFieldText(sheet.path, sheet.text);
      return value === null ? null : [{ path: sheet.path, value }];
    }
    case "schedule":
      return [
        { path: "schedule.weekday", value: sheet.weekday },
        { path: "schedule.startTime", value: sheet.time },
      ];
    case "save-template":
    case "template-picker":
    case "none":
      return null;
  }
}

/** The text under a sheet that cannot be confirmed, or `null` when it can. */
export function sheetErrorText(server: GroupSettings, sheet: SettingsSheet): string | null {
  const changes = sheetChanges(sheet);
  if (changes === null) return sheet.kind === "field" ? settingsStrings.errors.byCode["settings.wrong-type"] : null;
  const edited = changes.reduce((settings, { path, value }) => withLeaf(settings, path, value), server);
  return settingsError(edited);
}

function attendanceSummary(settings: GroupSettings): string {
  const { attendance, schedule } = settings;
  return [
    attendance.capacityLimited ? summary.limit(attendance.capacity) : summary.noLimit,
    attendance.regularsEnabled ? summary.regulars : null,
    attendance.dropInWindowEnabled ? summary.dropIn(attendance.dropInOpensHoursBefore) : null,
    schedule.enabled ? scheduleSummary(schedule.weekday, schedule.startTime) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(SUMMARY_SEPARATOR);
}

function scoringSummary(settings: GroupSettings): string {
  const { scoring } = settings;
  return [
    summary.points(scoring.pointsPerSet),
    summary.sets(scoring.bestOf),
    scoring.tieBreakEnabled ? summary.tieBreak(scoring.tieBreakPoints) : null,
    scoring.winMargin === 1 ? summary.noMargin : summary.margin(scoring.winMargin),
  ]
    .filter((part): part is string => part !== null)
    .join(SUMMARY_SEPARATOR);
}

/** The line under the title of an accordion block; "Desligado" while the block is off. */
export function blockSummary(block: "attendance" | "scoring", settings: GroupSettings): string {
  if (!settings[block].enabled) return screen.off;
  return block === "attendance" ? attendanceSummary(settings) : scoringSummary(settings);
}

/** "sem líbero" when the system plays without one, whatever the switch says (`deriveMatchRules`). */
export function liberoNote(settings: GroupSettings): string {
  return deriveMatchRules(settings).liberoAllowed ? summary.libero : summary.noLibero;
}

export interface ChoiceOption {
  readonly value: SettingsValue;
  readonly label: string;
  readonly pro: boolean;
}

/** The options of a choice leaf, in the order and with the Pro marks of the catalog. */
export function choiceOptions(path: SettingsPath): readonly ChoiceOption[] {
  const field = fieldOf(path);
  const labels = settingsStrings.choices[path] ?? {};
  return (field?.values ?? []).map((value) => ({
    value,
    label: labels[String(value)] ?? String(value),
    pro: field !== undefined && (field.pro || field.proValues.includes(value)),
  }));
}

export function isProLeaf(path: SettingsPath): boolean {
  return fieldOf(path)?.pro ?? false;
}

export function isBlockEnabled(block: SettingsBlock, settings: GroupSettings): boolean {
  return leafOf(settings, `${block}.enabled` as SettingsPath) === true;
}
