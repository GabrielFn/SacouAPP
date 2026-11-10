import {
  applyTemplate,
  defaultGroupSettings,
  getSettingsTemplate,
  type SettingsModality,
  type SettingsTemplateKey,
} from "@sacou/match-engine";

import { moneyFieldText } from "./money-text";

export interface ScheduleDraft {
  readonly weekday: number;
  readonly time: string;
}

export type SubmitState =
  | { readonly kind: "idle" }
  | { readonly kind: "created-without-settings"; readonly groupId: string }
  | { readonly kind: "done"; readonly groupId: string };

/** What the person typed or touched in screen 05, and nothing that can be derived from it. */
export interface CreateGroupState {
  readonly name: string;
  readonly scheduleWeekday: number | null;
  readonly scheduleTime: string | null;
  /** The open sheet of day and time, with its own draft; `null` when closed. */
  readonly scheduleSheet: ScheduleDraft | null;
  readonly venue: string;
  readonly capacityText: string;
  readonly modality: SettingsModality;
  readonly regulars: boolean;
  readonly charges: boolean;
  readonly dropInFeeText: string;
  readonly monthlyFeeText: string;
  readonly submit: SubmitState;
}

export type FeeKind = "dropIn" | "monthly";

export type ScheduleAction =
  | { readonly type: "schedule-opened"; readonly draft: ScheduleDraft }
  | { readonly type: "schedule-draft-changed"; readonly draft: ScheduleDraft }
  | { readonly type: "schedule-confirmed" }
  | { readonly type: "schedule-cancelled" };

export type AnswerAction =
  | { readonly type: "name-changed"; readonly name: string }
  | { readonly type: "venue-changed"; readonly venue: string }
  | { readonly type: "capacity-changed"; readonly text: string }
  | { readonly type: "modality-selected"; readonly modality: SettingsModality }
  | { readonly type: "regulars-selected"; readonly value: boolean }
  | { readonly type: "charges-selected"; readonly value: boolean }
  | { readonly type: "fee-changed"; readonly fee: FeeKind; readonly text: string };

export type LifecycleAction =
  | { readonly type: "init"; readonly templateKey: SettingsTemplateKey }
  | { readonly type: "group-created"; readonly groupId: string }
  | { readonly type: "settings-saved"; readonly groupId: string };

export type CreateGroupAction = ScheduleAction | AnswerAction | LifecycleAction;

const NOT_A_DIGIT = /\D/g;

/** The answers a template gives before the person touches anything (D3). */
export function createInitialState(templateKey: SettingsTemplateKey): CreateGroupState {
  const base = applyTemplate(defaultGroupSettings(), getSettingsTemplate(templateKey));
  return {
    name: "",
    scheduleWeekday: null,
    scheduleTime: null,
    scheduleSheet: null,
    venue: "",
    capacityText: base.attendance.capacityLimited ? String(base.attendance.capacity) : "",
    modality: base.format.modality,
    regulars: base.attendance.regularsEnabled,
    charges: base.money.enabled,
    dropInFeeText: moneyFieldText(base.money.dropInFeeCents),
    monthlyFeeText: moneyFieldText(base.money.monthlyFeeCents),
    submit: { kind: "idle" },
  };
}

function isScheduleAction(action: CreateGroupAction): action is ScheduleAction {
  return action.type.startsWith("schedule-");
}

function isLifecycleAction(action: CreateGroupAction): action is LifecycleAction {
  return (
    action.type === "init" || action.type === "group-created" || action.type === "settings-saved"
  );
}

function scheduleReducer(state: CreateGroupState, action: ScheduleAction): CreateGroupState {
  switch (action.type) {
    case "schedule-opened":
    case "schedule-draft-changed":
      return { ...state, scheduleSheet: action.draft };
    case "schedule-confirmed":
      return state.scheduleSheet === null
        ? state
        : {
            ...state,
            scheduleWeekday: state.scheduleSheet.weekday,
            scheduleTime: state.scheduleSheet.time,
            scheduleSheet: null,
          };
    case "schedule-cancelled":
      return { ...state, scheduleSheet: null };
  }
}

function answerReducer(state: CreateGroupState, action: AnswerAction): CreateGroupState {
  switch (action.type) {
    case "name-changed":
      return { ...state, name: action.name };
    case "venue-changed":
      return { ...state, venue: action.venue };
    case "capacity-changed":
      return { ...state, capacityText: action.text.replace(NOT_A_DIGIT, "") };
    case "modality-selected":
      return { ...state, modality: action.modality };
    case "regulars-selected":
      return { ...state, regulars: action.value };
    case "charges-selected":
      return { ...state, charges: action.value };
    case "fee-changed":
      return action.fee === "dropIn"
        ? { ...state, dropInFeeText: action.text }
        : { ...state, monthlyFeeText: action.text };
  }
}

function lifecycleReducer(state: CreateGroupState, action: LifecycleAction): CreateGroupState {
  switch (action.type) {
    case "init":
      return createInitialState(action.templateKey);
    case "group-created":
      return { ...state, submit: { kind: "created-without-settings", groupId: action.groupId } };
    case "settings-saved":
      return { ...state, submit: { kind: "done", groupId: action.groupId } };
  }
}

/** Pure: no call to the API and no navigation (frontend.md, rule 4). Three small exhaustive switches. */
export function createGroupReducer(
  state: CreateGroupState,
  action: CreateGroupAction,
): CreateGroupState {
  if (isScheduleAction(action)) return scheduleReducer(state, action);
  if (isLifecycleAction(action)) return lifecycleReducer(state, action);
  return answerReducer(state, action);
}
