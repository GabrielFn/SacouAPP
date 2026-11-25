import type { SettingsPath, SettingsValue } from "@sacou/match-engine";
import { useReducer } from "react";

import type { TemplateChoice } from "../../../services/api/sacou-api";
import type { ShownPath } from "../../../strings/settings.pt-BR";
import {
  groupSettingsFormReducer,
  initialGroupSettingsFormState,
  type GroupSettingsFormState,
} from "../model/group-settings-form.reducer";
import type { LayoutBlock } from "../model/settings-layout";
import { fieldSheetText } from "../model/group-settings.selectors";
import { canConfirmSheet, sheetError, type SettingsReady } from "../model/settings-screen-state";
import { useSettingsData } from "./use-settings-data";
import { useSettingsWrites } from "./use-settings-writes";

export interface GroupSettingsScreenModel {
  /** `null` while loading, or when there is nothing to show (see `failure`). */
  readonly ready: SettingsReady | null;
  readonly failure: { readonly text: string } | null;
  readonly bannerText: string | null;
  readonly form: GroupSettingsFormState;
  readonly sheetError: string | null;
  readonly canConfirmSheet: boolean;
  readonly retry: () => void;
  readonly changeLeaf: (path: SettingsPath, value: SettingsValue) => void;
  readonly toggleBlock: (block: LayoutBlock) => void;
  readonly openField: (path: ShownPath) => void;
  readonly openSchedule: () => void;
  readonly openPicker: () => void;
  readonly openSave: () => void;
  readonly setSheetText: (text: string) => void;
  readonly setSheetWeekday: (weekday: number) => void;
  readonly confirmSheet: () => void;
  readonly cancelSheet: () => void;
  readonly applyTemplate: (choice: TemplateChoice) => void;
  readonly deleteTemplate: (templateId: string) => void;
}

/**
 * Everything screen 18 needs: the two queries, the reducer of the drafts and the writes. Each change is
 * saved at once, one request per change, in order (D4); the document lives only in the query cache.
 */
export function useGroupSettingsScreen(groupId: string): GroupSettingsScreenModel {
  const [form, dispatch] = useReducer(groupSettingsFormReducer, initialGroupSettingsFormState);
  const { ready, failure, bannerText, retry } = useSettingsData(groupId, form.pending);
  const writes = useSettingsWrites({
    groupId,
    canManage: ready?.canManage ?? false,
    visible: ready?.settings ?? null,
    dispatch,
  });
  const error = sheetError(form.sheet, ready?.settings ?? null);

  return {
    ready,
    failure,
    bannerText,
    form,
    sheetError: error,
    canConfirmSheet: canConfirmSheet(form.sheet, error),
    retry,
    changeLeaf: (path, value) => {
      writes.changeLeaves([{ path, value }]);
    },
    toggleBlock: (block) => {
      dispatch({ type: "block-toggled", block });
    },
    openField: (path) => {
      if (ready === null) return;
      const text = fieldSheetText(path, ready.settings);
      dispatch({ type: "sheet-opened", sheet: { kind: "field", path, text } });
    },
    openSchedule: () => {
      if (ready === null) return;
      const { weekday, startTime } = ready.settings.schedule;
      dispatch({ type: "sheet-opened", sheet: { kind: "schedule", weekday, time: startTime } });
    },
    openPicker: () => {
      dispatch({ type: "sheet-opened", sheet: { kind: "template-picker" } });
    },
    openSave: () => {
      dispatch({ type: "sheet-opened", sheet: { kind: "save-template", name: "" } });
    },
    setSheetText: (text) => {
      dispatch({ type: "sheet-text-changed", text });
    },
    setSheetWeekday: (weekday) => {
      dispatch({ type: "sheet-weekday-selected", weekday });
    },
    confirmSheet: () => {
      writes.confirmSheet(form.sheet);
    },
    cancelSheet: () => {
      dispatch({ type: "sheet-cancelled" });
    },
    applyTemplate: writes.applyTemplate,
    deleteTemplate: writes.deleteTemplate,
  };
}
