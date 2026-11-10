import {
  applyTemplate,
  checkDisplayText,
  countLayerChanges,
  defaultGroupSettings,
  getSettingsTemplate,
  parseGroupSettings,
  type GroupSettings,
  type SettingsError,
  type SettingsLayer,
  type SettingsTemplateKey,
} from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { CreateGroupState } from "./create-group.reducer";
import { parseBrlToCents } from "./money-text";
import { settingsErrorText } from "./settings-errors-text";
import { settingsPatch } from "./settings-patch";

const { errors } = strings.createGroup;
const GROUP_NAME_MAX_LENGTH = 60;

/** Name and venue go to the server trimmed and in NFC, as `GroupName` of the API reads them. */
export function normalizeText(text: string): string {
  return text.trim().normalize("NFC");
}

/** The group the template alone would give: the base of the draft and of the patch. */
export function templateBase(templateKey: SettingsTemplateKey): GroupSettings {
  return applyTemplate(defaultGroupSettings(), getSettingsTemplate(templateKey));
}

function feeCents(text: string, fallback: number): number {
  return parseBrlToCents(text) ?? fallback;
}

/** The settings the answers make, on top of the template (D3). */
export function createGroupDraft(
  state: CreateGroupState,
  templateKey: SettingsTemplateKey,
): GroupSettings {
  const base = templateBase(templateKey);
  const capacity = state.capacityText === "" ? null : Number(state.capacityText);
  const scheduled = state.scheduleWeekday !== null && state.scheduleTime !== null;
  return {
    ...base,
    attendance: {
      ...base.attendance,
      capacityLimited: capacity !== null,
      capacity: capacity ?? base.attendance.capacity,
      regularsEnabled: state.regulars,
    },
    schedule: {
      enabled: scheduled,
      weekday: state.scheduleWeekday ?? base.schedule.weekday,
      startTime: state.scheduleTime ?? base.schedule.startTime,
      venue: normalizeText(state.venue),
    },
    format: { modality: state.modality },
    money: {
      enabled: state.charges,
      dropInFeeCents: feeCents(state.dropInFeeText, base.money.dropInFeeCents),
      monthlyFeeCents: feeCents(state.monthlyFeeText, base.money.monthlyFeeCents),
    },
  };
}

export interface CreateGroupErrors {
  readonly name?: string;
  readonly schedule?: string;
  readonly venue?: string;
  readonly capacity?: string;
  readonly dropInFee?: string;
  readonly monthlyFee?: string;
}

type ErrorField = keyof CreateGroupErrors;

function nameError(name: string): string | undefined {
  const normalized = normalizeText(name);
  if (normalized === "") return errors.nameRequired;
  const code = checkDisplayText(normalized, GROUP_NAME_MAX_LENGTH);
  if (code === null) return undefined;
  return code === "settings.out-of-range" ? errors.nameTooLong : errors.nameInvalid;
}

function fieldOfRefusal(error: SettingsError): ErrorField | null {
  switch (error.path) {
    case "attendance.capacity":
      return "capacity";
    case "schedule.venue":
      return "venue";
    case "schedule.startTime":
    case "schedule.weekday":
      return "schedule";
    default:
      return null;
  }
}

function moneyErrors(state: CreateGroupState): CreateGroupErrors {
  if (!state.charges) return {};
  return {
    ...(parseBrlToCents(state.dropInFeeText) === null ? { dropInFee: errors.money } : {}),
    ...(state.regulars && parseBrlToCents(state.monthlyFeeText) === null
      ? { monthlyFee: errors.money }
      : {}),
  };
}

function refusalErrors(state: CreateGroupState, key: SettingsTemplateKey): CreateGroupErrors {
  const parsed = parseGroupSettings(createGroupDraft(state, key));
  if (parsed.ok) return {};
  const field = fieldOfRefusal(parsed.error);
  return field === null ? {} : { [field]: settingsErrorText(parsed.error) };
}

/**
 * One error per field. The settings are checked by the engine's own parser, the rule of the server,
 * with the text chosen by its `code` and `path`; only the name and the money text are the app's.
 */
export function createGroupErrors(
  state: CreateGroupState,
  templateKey: SettingsTemplateKey,
): CreateGroupErrors {
  const name = nameError(state.name);
  return {
    ...(name === undefined ? {} : { name }),
    ...moneyErrors(state),
    ...refusalErrors(state, templateKey),
  };
}

/** The leaves the answers changed from the template; empty when there is nothing to save. */
export function createGroupPatch(
  state: CreateGroupState,
  templateKey: SettingsTemplateKey,
): SettingsLayer {
  return settingsPatch(templateBase(templateKey), createGroupDraft(state, templateKey));
}

export function hasPatch(layer: SettingsLayer): boolean {
  return countLayerChanges(layer) > 0;
}

export function canSubmit(state: CreateGroupState, templateKey: SettingsTemplateKey): boolean {
  const errors = createGroupErrors(state, templateKey);
  return state.submit.kind === "idle" && Object.keys(errors).length === 0;
}

export function isScheduleChosen(state: CreateGroupState): boolean {
  return state.scheduleWeekday !== null && state.scheduleTime !== null;
}
