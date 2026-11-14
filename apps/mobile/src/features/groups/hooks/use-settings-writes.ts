import type { GroupSettings } from "@sacou/match-engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Dispatch } from "react";

import type { TemplateChoice } from "../../../services/api/sacou-api";
import { useServices } from "../../../services/services-context";
import { normalizeText } from "../model/create-group.selectors";
import type { GroupSettingsFormAction, SettingsSheet } from "../model/group-settings-form.reducer";
import {
  settingsError,
  sheetChanges,
  sheetErrorText,
  type LeafChange,
} from "../model/group-settings.selectors";
import { failureText, saveFailureText, templateNameError } from "../model/settings-screen-state";
import { leafLayer, withLeaf } from "../model/settings-patch";
import {
  applyTemplateMutation,
  deleteTemplateMutation,
  saveTemplateMutation,
  updateSettingsMutation,
} from "../queries/group-settings-mutations";

export interface SettingsWrites {
  readonly changeLeaves: (changes: readonly LeafChange[]) => void;
  readonly confirmSheet: (sheet: SettingsSheet) => void;
  readonly applyTemplate: (choice: TemplateChoice) => void;
  readonly deleteTemplate: (templateId: string) => void;
}

export interface SettingsWritesInput {
  readonly groupId: string;
  readonly canManage: boolean;
  /** The document as shown, with the pending changes on top; `null` while it is not loaded. */
  readonly visible: GroupSettings | null;
  readonly dispatch: Dispatch<GroupSettingsFormAction>;
}

/**
 * Every write of screen 18: one request per change, in order inside the scope of the group (D4). The
 * answer goes to the cache by the mutation; here only the draft of the form is settled.
 */
export function useSettingsWrites({
  groupId,
  canManage,
  visible,
  dispatch,
}: SettingsWritesInput): SettingsWrites {
  const { sacouApi } = useServices();
  const client = useQueryClient();
  const update = useMutation(updateSettingsMutation(sacouApi, client, groupId));
  const apply = useMutation(applyTemplateMutation(sacouApi, client, groupId));
  const save = useMutation(saveTemplateMutation(sacouApi, client, groupId));
  const remove = useMutation(deleteTemplateMutation(sacouApi, client, groupId));

  function show(message: string): void {
    dispatch({ type: "message-shown", message });
  }

  function changeLeaves(changes: readonly LeafChange[]): void {
    if (!canManage || visible === null) return;
    const refusal = settingsError(
      changes.reduce((doc, { path, value }) => withLeaf(doc, path, value), visible),
    );
    if (refusal !== null) {
      show(refusal);
      return;
    }
    changes.forEach(({ path, value }) => {
      dispatch({ type: "leaf-changed", path, value });
    });
    update.mutateAsync(leafLayer(changes.map(({ path, value }) => [path, value] as const))).then(
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

  function confirmSheet(sheet: SettingsSheet): void {
    if (sheet.kind === "save-template") {
      if (templateNameError(sheet.name) !== null) return;
      save.mutateAsync(normalizeText(sheet.name)).then(
        () => {
          dispatch({ type: "sheet-confirmed" });
        },
        (error: unknown) => {
          show(saveFailureText(error));
        },
      );
      return;
    }
    const changes = sheetChanges(sheet);
    if (changes === null || (visible !== null && sheetErrorText(visible, sheet) !== null)) return;
    dispatch({ type: "sheet-confirmed" });
    changeLeaves(changes);
  }

  return {
    changeLeaves,
    confirmSheet,
    applyTemplate: (choice) => {
      apply.mutateAsync(choice).then(
        () => {
          dispatch({ type: "sheet-confirmed" });
        },
        (error: unknown) => {
          show(failureText(error));
        },
      );
    },
    deleteTemplate: (templateId) => {
      remove.mutateAsync(templateId).catch((error: unknown) => {
        show(failureText(error));
      });
    },
  };
}
