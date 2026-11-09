import { AccessibilityInfo } from "react-native";

import type { ReducedMotion } from "../features/court/ports/reduced-motion";

const CHANGE_EVENT = "reduceMotionChanged";

/** Follows the "remove animations" setting of the phone; until it answers, motion is allowed. */
export function createReactNativeReducedMotion(): ReducedMotion {
  const state = { value: false };
  const listeners = { value: [] as readonly (() => void)[] };
  const update = (reduced: boolean) => {
    if (reduced !== state.value) {
      state.value = reduced;
      listeners.value.forEach((listener) => {
        listener();
      });
    }
  };
  AccessibilityInfo.isReduceMotionEnabled().then(update, () => undefined);
  AccessibilityInfo.addEventListener(CHANGE_EVENT, update);
  return {
    getSnapshot: () => state.value,
    subscribe(listener) {
      listeners.value = [...listeners.value, listener];
      return () => {
        listeners.value = listeners.value.filter((known) => known !== listener);
      };
    },
  };
}
