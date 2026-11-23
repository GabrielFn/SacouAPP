import { useCallback, useEffect, useReducer, useRef } from "react";

import { useServices } from "../../../services/services-context";
import {
  askForPush,
  checkPushPrompt,
  createPromptLifetime,
  type PromptLifetime,
} from "../model/push-prompt";
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
export function usePushPrompt(signedIn: boolean): PushPromptModel {
  const { notificationPermission, pushPromptMemory, pushDevices, scheduler, pushOutcomeLog } =
    useServices();
  const [state, send] = useReducer(pushPromptReducer, INITIAL_PUSH_PROMPT);
  const checking = state === "checking";

  const lifetime = useRef<PromptLifetime | null>(null);

  // One lifetime per session: signing out cancels the waiting retry and mutes the late answers.
  useEffect(() => {
    if (!signedIn) return undefined;
    const current = createPromptLifetime();
    lifetime.current = current;
    return () => {
      current.stop();
      lifetime.current = null;
    };
  }, [signedIn]);

  useEffect(() => {
    const current = lifetime.current;
    if (!checking || current === null) return;
    void checkPushPrompt(
      { permission: notificationPermission, memory: pushPromptMemory },
      current.guarded(send),
    );
  }, [checking, signedIn, notificationPermission, pushPromptMemory]);

  const offer = useCallback(() => {
    send({ type: "offer-requested" });
  }, []);

  return {
    offer,
    visible: showsPushPrompt(state),
    accept: () => {
      const current = lifetime.current;
      if (current === null) return;
      send({ type: "accepted" });
      const register = () => {
        current.hold(syncWithOneRetry({ devices: pushDevices, scheduler, log: pushOutcomeLog }));
      };
      void askForPush({ permission: notificationPermission, register }, current.guarded(send));
    },
    decline: () => {
      send({ type: "declined" });
    },
  };
}
