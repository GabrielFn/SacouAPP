import {
  checkDisplayText,
  type GroupSettings,
  type SettingsBlock,
  type SettingsPath,
  type SettingsValue,
} from "@sacou/match-engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { apiErrorOf } from "../../../services/api/api-error";
import { errorTextOf } from "../../../services/api/api-error-text";
import { useOnline } from "../../../services/api/use-online";
import { wallClockNow } from "../../../services/api/wall-clock";
import type { Group, SavedTemplate, TemplateChoice } from "../../../services/api/sacou-api";
import { useServices } from "../../../services/services-context";
import { offlineBannerText } from "../../../services/query/staleness";
import { settingsStrings } from "../../../strings/settings.pt-BR";
import { normalizeText } from "../model/create-group.selectors";
import {
  groupSettingsFormReducer,
  initialGroupSettingsFormState,
  type GroupSettingsFormState,
} from "../model/group-settings-form.reducer";
import {
  canManageSettings,
  fieldSheetText,
  settingsError,
  sheetChanges,
  sheetErrorText,
  visibleSettings,
  type LeafChange,
} from "../model/group-settings.selectors";
import { leafLayer, withLeaf } from "../model/settings-patch";
import {
  templateLabel,
  type GroupSettingsView,
  type TemplateLabel,
} from "../model/settings-document";
import {
  applyTemplateMutation,
  deleteTemplateMutation,
  saveTemplateMutation,
  updateSettingsMutation,
} from "../queries/group-settings-mutations";
import { useGroup, useGroupSettings, useGroupTemplates } from "../queries/use-group-queries";

const TEMPLATE_NAME_MAX_LENGTH = 40;
const { errors, sheets } = settingsStrings;

export interface GroupSettingsScreenModel {
  /** `null` while loading, or when there is nothing to show (see `failure`). */
  readonly ready: {
    readonly group: Group;
    readonly view: GroupSettingsView;
    /** The server document with the pending changes on top. */
    readonly settings: GroupSettings;
    readonly canManage: boolean;
    readonly saved: readonly SavedTemplate[];
    readonly templateLabel: TemplateLabel;
  } | null;
  readonly failure: { readonly text: string } | null;
  readonly bannerText: string | null;
  readonly form: GroupSettingsFormState;
  readonly sheetError: string | null;
  readonly canConfirmSheet: boolean;
  readonly retry: () => void;
  readonly changeLeaf: (path: SettingsPath, value: SettingsValue) => void;
  readonly toggleBlock: (block: SettingsBlock) => void;
  readonly openField: (path: SettingsPath) => void;
  readonly openSchedule: () => void;
  readonly openPicker: () => void;
  readonly openSave: () => void;
  readonly setSheetText: (text: string) => void;
  readonly setSheetWeekday: (weekday: number) => void;
  readonly confirmSheet: () => void;
  readonly cancelSheet: () => void;
  readonly applyTemplate: (choice: TemplateChoice) => void;
  readonly deleteTemplate: (templateId: string) => void;
  readonly dismissMessage: () => void;
}

function failureText(error: unknown): string {
  return apiErrorOf(error)?.kind === "offline" ? errors.offline : errorTextOf(error);
}

function saveFailureText(error: unknown): string {
  const apiError = apiErrorOf(error);
  const full = apiError?.kind === "problem" && apiError.code === "groups.template-limit";
  return full ? errors.templateLimit : failureText(error);
}

function templateNameError(name: string): string | null {
  const normalized = normalizeText(name);
  if (normalized === "") return sheets.saveError;
  return checkDisplayText(normalized, TEMPLATE_NAME_MAX_LENGTH) === null ? null : sheets.saveError;
}

/**
 * Everything screen 18 needs: the two queries, the reducer of the drafts and the writes. Each change is
 * saved at once, one request per change, in order (D4); the document lives only in the query cache.
 */
export function useGroupSettingsScreen(groupId: string): GroupSettingsScreenModel {
  const { sacouApi } = useServices();
  const client = useQueryClient();
  const online = useOnline();
  const group = useGroup(groupId);
  const settings = useGroupSettings(groupId);
  const canManage = group.data !== undefined && canManageSettings(group.data.role);
  const templates = useGroupTemplates(groupId, canManage);
  const [form, dispatch] = useReducer(groupSettingsFormReducer, initialGroupSettingsFormState);

  const update = useMutation(updateSettingsMutation(sacouApi, client, groupId));
  const apply = useMutation(applyTemplateMutation(sacouApi, client, groupId));
  const save = useMutation(saveTemplateMutation(sacouApi, client, groupId));
  const remove = useMutation(deleteTemplateMutation(sacouApi, client, groupId));

  const view = settings.data;
  const visible = view === undefined ? null : visibleSettings(view.settings, form.pending);
  const saved = templates.data ?? [];

  function changeLeaves(changes: readonly LeafChange[]): void {
    if (!canManage || visible === null) return;
    const edited = changes.reduce((doc, { path, value }) => withLeaf(doc, path, value), visible);
    const refusal = settingsError(edited);
    if (refusal !== null) {
      dispatch({ type: "message-shown", message: refusal });
      return;
    }
    changes.forEach(({ path, value }) => {
      dispatch({ type: "leaf-changed", path, value });
    });
    const layer = leafLayer(changes.map(({ path, value }) => [path, value] as const));
    update.mutateAsync(layer).then(
      () => {
        changes.forEach(({ path }) => {
          dispatch({ type: "leaf-saved", path });
        });
      },
      (error: unknown) => {
        changes.forEach(({ path }) => {
          dispatch({ type: "leaf-failed", path, message: failureText(error) });
        });
      },
    );
  }

  function confirmSheet(): void {
    const sheet = form.sheet;
    if (sheet.kind === "save-template") {
      if (templateNameError(sheet.name) !== null) return;
      save.mutateAsync(normalizeText(sheet.name)).then(
        () => {
          dispatch({ type: "sheet-confirmed" });
        },
        (error: unknown) => {
          dispatch({ type: "message-shown", message: saveFailureText(error) });
        },
      );
      return;
    }
    const changes = sheetChanges(sheet);
    if (changes === null || (visible !== null && sheetErrorText(visible, sheet) !== null)) return;
    dispatch({ type: "sheet-confirmed" });
    changeLeaves(changes);
  }

  const failed = group.isError ? group.error : settings.isError ? settings.error : null;
  const sheetError =
    form.sheet.kind === "save-template"
      ? form.sheet.name === ""
        ? null
        : templateNameError(form.sheet.name)
      : visible === null
        ? null
        : sheetErrorText(visible, form.sheet);

  return {
    ready:
      group.data !== undefined && view !== undefined && visible !== null
        ? {
            group: group.data,
            view,
            settings: visible,
            canManage,
            saved,
            templateLabel: templateLabel(view, saved),
          }
        : null,
    failure:
      failed !== null && (group.data === undefined || view === undefined)
        ? { text: errorTextOf(failed) }
        : null,
    bannerText: offlineBannerText({
      online,
      dataUpdatedAt: settings.dataUpdatedAt,
      now: wallClockNow(),
    }),
    form,
    sheetError,
    canConfirmSheet:
      form.sheet.kind === "save-template"
        ? templateNameError(form.sheet.name) === null
        : sheetChanges(form.sheet) !== null && sheetError === null,
    retry: () => {
      void group.refetch();
      void settings.refetch();
    },
    changeLeaf: (path, value) => {
      changeLeaves([{ path, value }]);
    },
    toggleBlock: (block) => {
      dispatch({ type: "block-toggled", block });
    },
    openField: (path) => {
      if (visible === null) return;
      dispatch({ type: "sheet-opened", sheet: { kind: "field", path, text: fieldSheetText(path, visible) } });
    },
    openSchedule: () => {
      if (visible === null) return;
      dispatch({
        type: "sheet-opened",
        sheet: {
          kind: "schedule",
          weekday: visible.schedule.weekday,
          time: visible.schedule.startTime,
        },
      });
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
    confirmSheet,
    cancelSheet: () => {
      dispatch({ type: "sheet-cancelled" });
    },
    applyTemplate: (choice) => {
      apply.mutateAsync(choice).then(
        () => {
          dispatch({ type: "sheet-confirmed" });
        },
        (error: unknown) => {
          dispatch({ type: "message-shown", message: failureText(error) });
        },
      );
    },
    deleteTemplate: (templateId) => {
      remove.mutateAsync(templateId).catch((error: unknown) => {
        dispatch({ type: "message-shown", message: failureText(error) });
      });
    },
    dismissMessage: () => {
      dispatch({ type: "message-dismissed" });
    },
  };
}
