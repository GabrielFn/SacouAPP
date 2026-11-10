import type { SettingsLayer, SettingsTemplateKey } from "@sacou/match-engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import { useServices } from "../../../services/services-context";
import {
  createGroupReducer,
  createInitialState,
  type CreateGroupAction,
  type CreateGroupState,
} from "../model/create-group.reducer";
import {
  canSubmit,
  createGroupErrors,
  createGroupPatch,
  hasPatch,
  normalizeText,
  type CreateGroupErrors,
} from "../model/create-group.selectors";
import { createGroupFlow, saveCreatedGroupSettings } from "../queries/group-settings-mutations";

export interface CreateGroupModel {
  readonly state: CreateGroupState;
  readonly dispatch: (action: CreateGroupAction) => void;
  readonly errors: CreateGroupErrors;
  readonly canSubmit: boolean;
  /** True while a call is on the way: the button is off, against a double tap. */
  readonly pending: boolean;
  /** The text of the last refusal of the server, or `null`. */
  readonly errorText: string | null;
  readonly submit: () => void;
  readonly retrySettings: () => void;
}

/** Runs the reducer of screen 05 and the two calls of "Criar grupo"; the screen only draws (D3). */
export function useCreateGroup(
  templateKey: SettingsTemplateKey,
  onDone: (groupId: string) => void,
): CreateGroupModel {
  const { sacouApi } = useServices();
  const client = useQueryClient();
  const [state, dispatch] = useReducer(createGroupReducer, templateKey, createInitialState);

  const create = useMutation({
    mutationFn: () => {
      const patch: SettingsLayer = createGroupPatch(state, templateKey);
      return createGroupFlow(sacouApi, client, {
        name: normalizeText(state.name),
        templateKey,
        patch: hasPatch(patch) ? patch : null,
      });
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "done") {
        dispatch({ type: "settings-saved", groupId: outcome.groupId });
        onDone(outcome.groupId);
      } else {
        dispatch({ type: "group-created", groupId: outcome.groupId });
      }
    },
  });

  const retry = useMutation({
    mutationFn: (groupId: string) =>
      saveCreatedGroupSettings(sacouApi, client, groupId, createGroupPatch(state, templateKey)),
    onSuccess: (_result, groupId) => {
      dispatch({ type: "settings-saved", groupId });
      onDone(groupId);
    },
  });

  return {
    state,
    dispatch,
    errors: createGroupErrors(state, templateKey),
    canSubmit: canSubmit(state, templateKey),
    pending: create.isPending || retry.isPending,
    errorText: create.isError || retry.isError ? errorTextOf(retry.error ?? create.error) : null,
    submit: () => {
      create.mutate();
    },
    retrySettings: () => {
      if (state.submit.kind === "created-without-settings") retry.mutate(state.submit.groupId);
    },
  };
}
