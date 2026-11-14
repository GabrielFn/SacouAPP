import type { GroupSettings } from "@sacou/match-engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { useServices } from "../../../services/services-context";
import { settingsError } from "../model/group-settings.selectors";
import { draftOf, queueRuleLayer, withDraft } from "../model/queue-rule";
import {
  initialQueueRuleState,
  queueRuleReducer,
  type QueueRuleAction,
  type QueueRuleState,
} from "../model/queue-rule.reducer";
import { failureText } from "../model/settings-screen-state";
import { updateSettingsMutation } from "../queries/group-settings-mutations";

export interface QueueRuleFormModel {
  readonly state: QueueRuleState;
  readonly dispatch: (action: QueueRuleAction) => void;
  readonly pending: boolean;
  readonly save: () => void;
}

/** The draft of screen 18a and its single `PATCH`; leaving without saving drops the draft. */
export function useQueueRuleForm(
  groupId: string,
  saved: GroupSettings,
  onSaved: () => void,
): QueueRuleFormModel {
  const { sacouApi } = useServices();
  const client = useQueryClient();
  const [state, dispatch] = useReducer(queueRuleReducer, saved, (settings) =>
    initialQueueRuleState(draftOf(settings)),
  );
  const update = useMutation(updateSettingsMutation(sacouApi, client, groupId));
  return {
    state,
    dispatch,
    pending: update.isPending,
    save: () => {
      if (update.isPending) return;
      const refusal = settingsError(withDraft(saved, state.draft));
      if (refusal !== null) {
        dispatch({ type: "save-failed", message: refusal });
        return;
      }
      const layer = queueRuleLayer(saved, state.draft);
      if (layer === null) {
        onSaved();
        return;
      }
      update.mutate(layer, {
        onSuccess: onSaved,
        onError: (error: unknown) => {
          dispatch({ type: "save-failed", message: failureText(error) });
        },
      });
    },
  };
}
