import { useCallback, useEffect, useReducer } from "react";

import { useServices } from "../../../services/services-context";
import { askForPush, checkPushPrompt } from "../model/push-prompt";
import {
  INITIAL_PUSH_PROMPT,
  pushPromptReducer,
  showsPushPrompt,
} from "../model/push-prompt.reducer";
import { syncWithOneRetry } from "../registration/sync-with-one-retry";

export interface PushPromptModel {
  /** A first "VOU" or a first round: the offer starts, if it is due. */
  readonly offer: () => void;
  readonly visible: boolean;
  readonly accept: () => void;
  readonly decline: () => void;
}

/** The offer of the notifications of the signed-in app: the reducer, the reads and the question. */
export function usePushPrompt(): PushPromptModel {
  const { notificationPermission, pushPromptMemory, pushDevices, scheduler, pushOutcomeLog } =
    useServices();
  const [state, send] = useReducer(pushPromptReducer, INITIAL_PUSH_PROMPT);
  const checking = state === "checking";

  useEffect(() => {
    if (!checking) return;
    void checkPushPrompt({ permission: notificationPermission, memory: pushPromptMemory }, send);
  }, [checking, notificationPermission, pushPromptMemory]);

  const offer = useCallback(() => {
    send({ type: "offer-requested" });
  }, []);

  return {
    offer,
    visible: showsPushPrompt(state),
    accept: () => {
      send({ type: "accepted" });
      const register = () => {
        syncWithOneRetry({ devices: pushDevices, scheduler, log: pushOutcomeLog });
      };
      void askForPush({ permission: notificationPermission, register }, send);
    },
    decline: () => {
      send({ type: "declined" });
    },
  };
}
