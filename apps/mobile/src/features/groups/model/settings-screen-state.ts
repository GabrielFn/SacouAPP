import { checkDisplayText, type GroupSettings } from "@sacou/match-engine";

import { apiErrorOf } from "../../../services/api/api-error";
import { errorTextOf } from "../../../services/api/api-error-text";
import type { Group, SavedTemplate } from "../../../services/api/sacou-api";
import { settingsStrings } from "../../../strings/settings.pt-BR";
import { normalizeText } from "./create-group.selectors";
import type { PendingLeaves, SettingsSheet } from "./group-settings-form.reducer";
import {
  canManageSettings,
  sheetChanges,
  sheetErrorText,
  visibleSettings,
} from "./group-settings.selectors";
import { templateLabel, type GroupSettingsView, type TemplateLabel } from "./settings-document";

const TEMPLATE_NAME_MAX_LENGTH = 40;
const { errors, sheets } = settingsStrings;

/** Everything screen 18 draws once both queries have answered. */
export interface SettingsReady {
  readonly group: Group;
  readonly view: GroupSettingsView;
  /** The server document with the pending changes on top. */
  readonly settings: GroupSettings;
  readonly canManage: boolean;
  readonly saved: readonly SavedTemplate[];
  readonly templateLabel: TemplateLabel;
}

export function settingsReady(
  group: Group | undefined,
  view: GroupSettingsView | undefined,
  pending: PendingLeaves,
  saved: readonly SavedTemplate[],
): SettingsReady | null {
  if (group === undefined || view === undefined) return null;
  return {
    group,
    view,
    settings: visibleSettings(view.settings, pending),
    canManage: canManageSettings(group.role),
    saved,
    templateLabel: templateLabel(view, saved),
  };
}

/** The text of a failed write; offline gets its own, since nothing is queued. */
export function failureText(error: unknown): string {
  return apiErrorOf(error)?.kind === "offline" ? errors.offline : errorTextOf(error);
}

export function saveFailureText(error: unknown): string {
  const apiError = apiErrorOf(error);
  const full = apiError?.kind === "problem" && apiError.code === "groups.template-limit";
  return full ? errors.templateLimit : failureText(error);
}

/** The refusal of a template name, or `null` when it can be saved (the server has the last word). */
export function templateNameError(name: string): string | null {
  const normalized = normalizeText(name);
  if (normalized === "") return sheets.saveError;
  return checkDisplayText(normalized, TEMPLATE_NAME_MAX_LENGTH) === null ? null : sheets.saveError;
}

/** The error under the open sheet, as the person would read it; nothing while the name is empty. */
export function sheetError(sheet: SettingsSheet, settings: GroupSettings | null): string | null {
  if (sheet.kind === "save-template") {
    return sheet.name === "" ? null : templateNameError(sheet.name);
  }
  return settings === null ? null : sheetErrorText(settings, sheet);
}

export function canConfirmSheet(sheet: SettingsSheet, error: string | null): boolean {
  if (sheet.kind === "save-template") return templateNameError(sheet.name) === null;
  return sheetChanges(sheet) !== null && error === null;
}
