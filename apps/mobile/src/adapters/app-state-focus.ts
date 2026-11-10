import { focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";

/** Coming back to the app counts as focus for TanStack, which refetches stale queries (D6). */
export function bindAppStateFocus(): () => void {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (status) => {
      setFocused(status === "active");
    });
    return () => {
      subscription.remove();
    };
  });
  return () => {
    focusManager.setEventListener(() => undefined);
  };
}
