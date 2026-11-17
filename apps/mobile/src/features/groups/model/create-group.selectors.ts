import {
  checkDisplayText,
  countLayerChanges,
  parseGroupSettings,
  type GroupSettings,
  type SettingsError,
  type SettingsLayer,
} from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { CreateGroupState } from "./create-group.reducer";
import { originBase, serverBase, type GroupOrigin } from "./custom-blocks";
import { settingsErrorText } from "./settings-errors-text";
import { settingsPatch } from "./settings-patch";

const { errors } = strings.createGroup;
const GROUP_NAME_MAX_LENGTH = 60;

/** Name and venue go to the server trimmed and in NFC, as `GroupName` of the API reads them. */
export function normalizeText(text: string): string {
  return text.trim().normalize("NFC");
}

/** The settings the answers make, on top of the origin (D3). The `money.*` leaves are never touched. */
export function createGroupDraft(state: CreateGroupState, origin: GroupOrigin): GroupSettings {
  const base = originBase(origin);
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
  };
}

export interface CreateGroupErrors {
  readonly name?: string;
  readonly schedule?: string;
  readonly venue?: string;
  readonly capacity?: string;
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

function refusalErrors(state: CreateGroupState, origin: GroupOrigin): CreateGroupErrors {
  const parsed = parseGroupSettings(createGroupDraft(state, origin));
  if (parsed.ok) return {};
  const field = fieldOfRefusal(parsed.error);
  return field === null ? {} : { [field]: settingsErrorText(parsed.error) };
}

/**
 * One error per field. The settings are checked by the engine's own parser, the rule of the server,
 * with the text chosen by its `code` and `path`; only the name is the app's.
 */
export function createGroupErrors(state: CreateGroupState, origin: GroupOrigin): CreateGroupErrors {
  const name = nameError(state.name);
  return {
    ...(name === undefined ? {} : { name }),
    ...refusalErrors(state, origin),
  };
}

/**
 * The leaves that differ from what the server creates from the template key: the blocks of screen 04a and
 * the answers. Empty when there is nothing to save.
 */
export function createGroupPatch(state: CreateGroupState, origin: GroupOrigin): SettingsLayer {
  return settingsPatch(serverBase(origin), createGroupDraft(state, origin));
}

export function hasPatch(layer: SettingsLayer): boolean {
  return countLayerChanges(layer) > 0;
}

export function canSubmit(state: CreateGroupState, origin: GroupOrigin): boolean {
  const errors = createGroupErrors(state, origin);
  return state.submit.kind === "idle" && Object.keys(errors).length === 0;
}

/** "Criar grupo" is off while the form is invalid, already sent, or a call is on the way. */
export function isSubmitDisabled(
  state: CreateGroupState,
  origin: GroupOrigin,
  pending: boolean,
): boolean {
  return pending || !canSubmit(state, origin);
}

/** "Tentar de novo" is off while its call is on the way, or when there is nothing to retry. */
export function isRetryDisabled(state: CreateGroupState, pending: boolean): boolean {
  return pending || state.submit.kind !== "created-without-settings";
}

export function isScheduleChosen(state: CreateGroupState): boolean {
  return state.scheduleWeekday !== null && state.scheduleTime !== null;
}

/**
 * The errors the screen draws. The rules above decide if the form can be sent; here an empty name stays
 * quiet until the person leaves the field, so the screen does not open already in red.
 */
export function visibleCreateGroupErrors(
  state: CreateGroupState,
  origin: GroupOrigin,
): CreateGroupErrors {
  const { name, ...others } = createGroupErrors(state, origin);
  const showsName = state.nameTouched || normalizeText(state.name) !== "";
  return { ...others, ...(showsName && name !== undefined ? { name } : {}) };
}
