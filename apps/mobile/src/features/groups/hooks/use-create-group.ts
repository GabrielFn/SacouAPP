import type { SettingsLayer } from "@sacou/match-engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import { useServices } from "../../../services/services-context";
import type { GroupOrigin } from "../model/custom-blocks";
import {
  createGroupReducer,
  createInitialState,
  type CreateGroupAction,
  type CreateGroupState,
} from "../model/create-group.reducer";
import {
  canSubmit,
  isSubmitDisabled,
  visibleCreateGroupErrors,
  createGroupPatch,
  hasPatch,
  normalizeText,
  type CreateGroupErrors,
} from "../model/create-group.selectors";
import { createGroupFlow } from "../queries/group-settings-mutations";

export interface CreateGroupModel {
  readonly state: CreateGroupState;
  readonly dispatch: (action: CreateGroupAction) => void;
  readonly errors: CreateGroupErrors;
  readonly canSubmit: boolean;
  readonly submitDisabled: boolean;
  /** True while a call is on the way: the button is off, against a double tap. */
  readonly pending: boolean;
  /** The text of the last refusal of the server, or `null`. */
  readonly errorText: string | null;
  readonly submit: () => void;
}

/** Runs the reducer of screen 05 and the call of "Criar grupo"; the screen only draws (D3). */
export function useCreateGroup(
  origin: GroupOrigin,
  onDone: (groupId: string) => void,
): CreateGroupModel {
  const { sacouApi } = useServices();
  const client = useQueryClient();
  const [state, dispatch] = useReducer(createGroupReducer, origin, createInitialState);

  const create = useMutation({
    mutationFn: () => {
      const patch: SettingsLayer = createGroupPatch(state, origin);
      return createGroupFlow(sacouApi, client, {
        name: normalizeText(state.name),
        templateKey: origin.templateKey,
        patch: hasPatch(patch) ? patch : null,
      });
    },
    onSuccess: (groupId) => {
      dispatch({ type: "settings-saved", groupId });
      onDone(groupId);
    },
  });

  const pending = create.isPending;
  return {
    state,
    dispatch,
    errors: visibleCreateGroupErrors(state, origin),
    canSubmit: canSubmit(state, origin),
    submitDisabled: isSubmitDisabled(state, origin, pending),
    pending,
    errorText: create.isError ? errorTextOf(create.error) : null,
    submit: () => {
      create.mutate();
    },
  };
}
